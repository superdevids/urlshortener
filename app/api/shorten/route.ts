/**
 * @fileoverview Rate limiting middleware for API routes.
 * Implements a simple in-memory store to track request counts per IP address.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRepository } from '@/lib/storage';
import { shortenUrlSchema, ShortenUrlInput } from '@/lib/validators';
import { generateUniqueShortCode } from '@/lib/short-code';
import { isZodError } from '@/types/errors';

// --- Rate Limiting ---

interface RateLimitEntry {
  count: number;
  windowStart: number; // Timestamp of when the current window started
}

// Simple in-memory store for rate limiting. Key is IP address.
const rateLimitStore = new Map<string, RateLimitEntry>();

// Retrieve rate limit settings from environment variables, with defaults
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute window

/**
 * Gets the client's IP address from the request headers.
 * Prioritizes common proxy headers for App Router.
 * @param req - The Next.js App Router Request object
 * @returns The client's IP address
 */
function getClientIp(req: Request): string {
  // NOTE: Accessing headers directly might not work reliably in all serverless environments.
  // Consider using a middleware or a more robust IP detection method if needed.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // Fallback to x-real-ip header
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Checks if a given IP address has exceeded the rate limit.
 * Updates the rate limit store if the request is allowed.
 * @param {string} ip - The client's IP address.
 * @returns {Promise<boolean>} True if the request is within the limit, false otherwise.
 */
async function checkAndApplyRateLimit(ip: string): Promise<boolean> {
  if (ip === 'unknown' || !ip) return true; // Allow if IP is unknown or not provided

  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry) {
    // First request from this IP
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }

  const timeSinceWindowStart = now - entry.windowStart;

  if (timeSinceWindowStart >= RATE_LIMIT_WINDOW_MS) {
    // Rate limit window has passed, reset count and update window start
    entry.count = 1;
    entry.windowStart = now;
    return true;
  } else if (entry.count >= RATE_LIMIT_MAX) {
    // Request exceeds the rate limit
    return false;
  } else {
    // Within the window and below the limit, increment count
    entry.count++;
    return true;
  }
}

// --- API Route Handler for POST /api/shorten ---

// Use NextResponse for App Router handlers
export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req); // Get IP for rate limiting

  // Check rate limit before proceeding
  if (!(await checkAndApplyRateLimit(ip))) {
    return NextResponse.json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please try again later.' } }, { status: 429 });
  }

  try {
    // Parse and validate the request body
    const body = await req.json();
    // Ensure body is parsed correctly before validation
    const validationResult = shortenUrlSchema.safeParse(body);

    if (!validationResult.success) {
      // Return detailed validation errors
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: validationResult.error.flatten().fieldErrors } }, { status: 400 });
    }
    
    const inputData: ShortenUrlInput = validationResult.data;
    const repository = getRepository();

    let shortCode: string;

    // Handle custom alias scenario
    if (inputData.customAlias) {
      const exists = await repository.existsByShortCode(inputData.customAlias);
      if (exists) {
        // Return conflict error if alias is already in use
        return NextResponse.json({ error: { code: 'CONFLICT', message: 'Custom alias is already in use.' } }, { status: 409 });
      }
      shortCode = inputData.customAlias;
    } else {
      // Generate a unique short code if no custom alias is provided
      // Pass the repository's existence check method to the generator
      shortCode = await generateUniqueShortCode(
          async (code) => repository.existsByShortCode(code),
          6 // Default length 6
       );
    }

    // Create the new link using the repository
    const newLink = await repository.create({
      originalUrl: inputData.originalUrl,
      // Ensure customAlias is passed correctly if it was provided
      customAlias: inputData.customAlias, 
      expiresInDays: inputData.expiresInDays,
    });

    // Construct the full short URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`; // Default to localhost:3000
    const fullShortUrl = new URL(`/${newLink.shortCode}`, baseUrl).toString();

    // Return success response
    return NextResponse.json({
      shortCode: newLink.shortCode,
      fullShortUrl: fullShortUrl,
      originalUrl: newLink.originalUrl,
    }, { status: 201 }); // 201 Created

  } catch (error: unknown) {
    // Handle unexpected errors
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in POST /api/shorten:', error);
    }
    
    // Check if it's a Zod parsing error (already handled by safeParse, but as a fallback)
    if (isZodError(error)) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: error.issues } }, { status: 400 });
    }

    // Generic server error
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } }, { status: 500 });
  }
}

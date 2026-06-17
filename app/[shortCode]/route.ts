/**
 * @fileoverview Route handler for handling individual short link redirection.
 * Implements the GET /[shortCode] dynamic route.
 */

import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/storage';

// Using Request and NextResponse for App Router
export async function GET(req: Request, { params }: { params: { shortCode: string } }) {
  const { shortCode } = params;

  // Basic validation for shortCode
  if (!shortCode) {
    return new NextResponse(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Short code is required.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const repository = getRepository();

  try {
    // Find the link by its short code
    const link = await repository.findByShortCode(shortCode);

    // Handle case where the link is not found
    if (!link) {
      // Ideally, return a custom 404 page. For API route, return JSON error.
      return new NextResponse(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'The short link was not found.' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if the link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
       // Return a 410 Gone status for expired links
       return new NextResponse(JSON.stringify({ error: { code: 'GONE', message: 'This short link has expired.' } }), {
        status: 410, 
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Increment the click count and update the last clicked timestamp
    await repository.incrementClick(shortCode);

    // Redirect the user to the original URL with a 302 Found status
    return NextResponse.redirect(link.originalUrl, 302);

  } catch (error) {
    // Log the error for debugging purposes
    console.error(`Error processing redirect for short code "${shortCode}":`, error);
    
    // Return a generic server error response
    return new NextResponse(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred during redirection.' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

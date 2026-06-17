/**
 * @fileoverview Route handler for handling individual short link redirection.
 * Implements the GET /[shortCode] dynamic route.
 */

import { NextResponse } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { getRepository } from '@/lib/storage';

// Using Request and NextResponse for App Router
export async function GET(
  req: Request,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params;

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
      // Use Next.js notFound() to render the custom not-found.tsx page
      notFound();
    }

    // Check if the link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
       // Redirect to the custom expired page with query parameters
       redirect(`/expired?code=${shortCode}&expiredAt=${link.expiresAt}`);
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

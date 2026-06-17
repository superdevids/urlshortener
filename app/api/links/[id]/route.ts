/**
 * @fileoverview Route handler for managing links (GET all, DELETE by ID).
 * Handles API requests to /api/links and /api/links/[id].
 */

import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/storage';
import { Link } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// --- Handler for GET /api/links ---
// Fetches all links.
export async function GET() {
  const repository = getRepository();
  try {
    const links: Link[] = await repository.findAll();
    // Enhance links with their full short URLs
    const enhancedLinks = links.map(link => ({
      ...link,
      fullShortUrl: new URL(`/${link.shortCode}`, BASE_URL).toString(),
      isExpired: link.expiresAt ? new Date(link.expiresAt) < new Date() : false,
    }));
    return NextResponse.json(enhancedLinks);
  } catch (error) {
    console.error('Error fetching all links:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch links.' } }, { status: 500 });
  }
}

// --- Handler for DELETE /api/links/[id] ---
// Deletes a specific link by its ID.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Link ID is required.' } }, { status: 400 });
  }

  const repository = getRepository();
  try {
    const deleted = await repository.delete(id);
    if (deleted) {
      // Successful deletion, return No Content
      return new NextResponse(null, { status: 204 }); 
    } else {
      // Link not found, return Not Found
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Link not found.' } }, { status: 404 });
    }
  } catch (error) {
    console.error(`Error deleting link with ID ${id}:`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete link.' } }, { status: 500 });
  }
}

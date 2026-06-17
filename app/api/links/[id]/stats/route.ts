/**
 * @fileoverview Route handler for retrieving analytics for a specific link.
 * Handles GET /api/links/[id]/stats. Returns click count and last clicked time.
 */

import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/storage';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // 'id' here refers to the link's unique identifier (UUID)

  if (!id) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Link ID is required.' } }, { status: 400 });
  }

  const repository = getRepository();
  try {
    // Fetch the link using its ID
    const link = await repository.findById(id);

    if (!link) {
      // If the link is not found, return a 404 error
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Link not found.' } }, { status: 404 });
    }

    // Return only the statistics part of the link object
    return NextResponse.json({
      clickCount: link.clickCount,
      lastClickedAt: link.lastClickedAt,
    });
  } catch (error) {
    // Log unexpected errors and return a server error response
    console.error(`Error fetching link stats for ID ${id}:`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch link statistics.' } }, { status: 500 });
  }
}

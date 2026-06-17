import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/storage';
import { Link } from '@/types';

export async function GET() {
  const repository = getRepository();
  try {
    const links: Link[] = await repository.findAll();
    return NextResponse.json(links);
  } catch (error) {
    console.error('Error fetching all links:', error);
    return new NextResponse(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const analytics = db.getAnalytics();
    return NextResponse.json(analytics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve analytics metrics.' },
      { status: 500 }
    );
  }
}

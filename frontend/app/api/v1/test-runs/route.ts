import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const runs = db.getTestRuns();
    return NextResponse.json(runs, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve test execution records.' },
      { status: 500 }
    );
  }
}

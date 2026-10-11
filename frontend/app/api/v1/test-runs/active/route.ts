import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const activeRun = db.getActiveTestRun();
    return NextResponse.json(activeRun, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve active execution session.' },
      { status: 500 }
    );
  }
}

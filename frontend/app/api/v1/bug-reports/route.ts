import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const bugs = db.getBugReports();
    return NextResponse.json(bugs, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve bug reports and defect records.' },
      { status: 500 }
    );
  }
}

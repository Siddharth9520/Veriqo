import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bug = db.getBugReport(id);

    if (!bug) {
      return NextResponse.json(
        { error: `Defect record '${id}' not found in registry.` },
        { status: 404 }
      );
    }

    return NextResponse.json(bug, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve defect record details.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pinned = db.pinBugReport(id);

    if (!pinned) {
      return NextResponse.json(
        { error: `Defect '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(pinned, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to pin defect to vault.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectSlug, swarmMode, environment } = body;

    if (!projectSlug || typeof projectSlug !== 'string') {
      return NextResponse.json(
        { error: 'Valid projectSlug is required to initialize an execution run.' },
        { status: 400 }
      );
    }

    const run = db.startTestRun({
      projectSlug,
      swarmMode: swarmMode || 'Deep Heuristic',
      environment: environment || 'Staging',
    });

    return NextResponse.json(run, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to dispatch new autonomous execution run.' },
      { status: 500 }
    );
  }
}

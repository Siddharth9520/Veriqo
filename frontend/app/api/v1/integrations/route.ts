import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const integrations = db.getIntegrations();
    return NextResponse.json(integrations, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve third-party integrations.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, configured } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Integration ID is required.' },
        { status: 400 }
      );
    }

    const updated = db.updateIntegration(id, {
      ...(status !== undefined ? { status } : {}),
      ...(configured !== undefined ? { configured } : {}),
    });

    if (!updated) {
      return NextResponse.json(
        { error: `Integration '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update integration configuration.' },
      { status: 500 }
    );
  }
}

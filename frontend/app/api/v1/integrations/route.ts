import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { backendFetch } from '@/lib/backend-bridge';

export async function GET() {
  try {
    try {
      const liveIntegrations = await backendFetch<unknown[]>('/api/v1/integrations');
      return NextResponse.json(liveIntegrations, {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    } catch {
      // Fallback to local offline cache
    }

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

    try {
      const liveUpdated = await backendFetch<unknown>('/api/v1/integrations', {
        method: 'PATCH',
        body: JSON.stringify({ id, status, configured }),
      });
      return NextResponse.json(liveUpdated, { status: 200 });
    } catch {
      // Fallback to local offline cache
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

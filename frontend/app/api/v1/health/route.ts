import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const health = db.getClusterHealth();
    return NextResponse.json(health, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Service': 'cluster-orchestrator',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve cluster health telemetry' },
      { status: 500 }
    );
  }
}

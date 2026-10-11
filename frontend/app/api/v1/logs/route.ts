import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const logs = db.getLogs();
    return NextResponse.json(logs, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve terminal execution logs.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent, message, type } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Log message is required.' },
        { status: 400 }
      );
    }

    const newLog = db.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().substring(11, 19),
      agent: agent || 'OPERATOR',
      message,
      type: type || 'info',
    });

    return NextResponse.json(newLog, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to record terminal log.' },
      { status: 500 }
    );
  }
}

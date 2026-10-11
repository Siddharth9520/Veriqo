import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const tests = db.getTestLibrary();
    return NextResponse.json(tests, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve test library cases.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, category, projectSlug, projectName, assertions } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Test scenario title is required.' },
        { status: 400 }
      );
    }

    const created = db.addTestCase({
      name: name.trim(),
      description: description || 'User-defined heuristic boundary assertion.',
      category: category || 'E2E Concurrency & Payments',
      projectSlug: projectSlug || 'commerce-platform',
      projectName: projectName || 'Commerce Platform (Storefront Web)',
      assertions: typeof assertions === 'number' ? assertions : 18,
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create new test library scenario.' },
      { status: 500 }
    );
  }
}

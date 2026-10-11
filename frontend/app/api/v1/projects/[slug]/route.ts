import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const project = db.getProject(slug);

    if (!project) {
      return NextResponse.json(
        { error: `Project '${slug}' not found in cluster registry.` },
        { status: 404 }
      );
    }

    return NextResponse.json(project, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve project details.' },
      { status: 500 }
    );
  }
}

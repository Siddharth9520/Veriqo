import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const projects = db.getProjects();
    return NextResponse.json(projects, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve registered projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, domain, environment, swarmMode } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project name is required and cannot be empty.' },
        { status: 400 }
      );
    }

    if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
      return NextResponse.json(
        { error: 'Application URL or domain is required.' },
        { status: 400 }
      );
    }

    // Clean and validate URL/domain with strict SSRF and protocol protection
    let hostname = domain.trim().toLowerCase();
    if (hostname.includes('://')) {
      try {
        const parsed = new URL(hostname);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'Security policy: Only http:// and https:// application endpoints are allowed.' },
            { status: 400 }
          );
        }
        hostname = parsed.hostname;
      } catch {
        return NextResponse.json(
          { error: 'Malformed application URL provided.' },
          { status: 400 }
        );
      }
    } else {
      hostname = hostname.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0].trim();
    }

    // SSRF Safeguards: Protect internal cloud metadata and dangerous targets
    const FORBIDDEN_SSRF = [
      '169.254.169.254',
      'metadata.google.internal',
      '169.254.',
      'instance-data',
    ];

    if (FORBIDDEN_SSRF.some((blocked) => hostname === blocked || hostname.startsWith(blocked))) {
      return NextResponse.json(
        { error: 'Security Policy Violation: Access to internal cloud metadata services is strictly forbidden.' },
        { status: 403 }
      );
    }

    // Strict hostname syntax check
    const HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!HOSTNAME_REGEX.test(hostname)) {
      return NextResponse.json(
        { error: 'Invalid application domain. Provide a valid hostname (e.g., staging.myapp.dev or https://myapp.com).' },
        { status: 400 }
      );
    }

    // Sanitize project name to prevent Stored XSS
    const sanitizedName = name.replace(/[<>]/g, '').trim();

    const created = db.addProject({
      name: sanitizedName,
      domain: hostname,
      environment: environment || 'Staging',
      swarmMode: swarmMode || 'Deep Heuristic',
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Malformed request payload or server processing error.' },
      { status: 500 }
    );
  }
}

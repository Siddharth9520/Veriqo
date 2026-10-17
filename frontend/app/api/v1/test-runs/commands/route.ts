import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TerminalLog } from '@/lib/types';
import { backendFetch } from '@/lib/backend-bridge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command } = body;

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return NextResponse.json(
        { error: 'Command string is required.' },
        { status: 400 }
      );
    }

    const trimmed = command.trim();

    // 1. Attempt dispatch to FastAPI backend first
    try {
      const backendRes = await backendFetch<{
        success: boolean;
        command: string;
        logs: TerminalLog[];
      }>('/api/v1/test-runs/commands', {
        method: 'POST',
        body: JSON.stringify({ command: trimmed }),
      });

      if (backendRes && backendRes.logs) {
        backendRes.logs.forEach((log) => db.addLog(log));
        return NextResponse.json(backendRes);
      }
    } catch {
      // Backend unavailable; fall through to local offline mock engine
    }

    const timestamp = new Date().toISOString().substring(11, 19);

    // Record user command injection
    const userLog: TerminalLog = {
      id: `cmd-${Date.now()}`,
      timestamp,
      agent: 'OPERATOR',
      message: `$ ${trimmed}`,
      type: 'info',
    };
    db.addLog(userLog);

    let systemResponse: TerminalLog;
    const lower = trimmed.toLowerCase();

    if (lower === 'help') {
      systemResponse = {
        id: `resp-${Date.now() + 1}`,
        timestamp,
        agent: 'ORCHESTRATOR',
        message: 'Commands: status | pause | resume | abort | fuzz [target] | inject [payload] | inspect-dom',
        type: 'info',
      };
    } else if (lower === 'status') {
      const active = db.getActiveTestRun();
      systemResponse = {
        id: `resp-${Date.now() + 1}`,
        timestamp,
        agent: 'ORCHESTRATOR',
        message: `Execution ${active.runNumber}: Status [${active.status.toUpperCase()}], Step: ${active.currentStepTitle}, Assertions: ${active.evaluatedAssertions}/${active.totalAssertions}`,
        type: 'info',
      };
    } else if (lower === 'pause') {
      const active = db.getActiveTestRun();
      db.updateTestRunStatus(active.id, 'paused');
      systemResponse = {
        id: `resp-${Date.now() + 1}`,
        timestamp,
        agent: 'ORCHESTRATOR',
        message: `Execution ${active.runNumber} paused across all 3 swarm workers. Browser threads frozen.`,
        type: 'warning',
      };
    } else if (lower === 'resume') {
      const active = db.getActiveTestRun();
      db.updateTestRunStatus(active.id, 'running');
      systemResponse = {
        id: `resp-${Date.now() + 1}`,
        timestamp,
        agent: 'ORCHESTRATOR',
        message: `Execution ${active.runNumber} resumed. Worker threads unthrottled.`,
        type: 'success',
      };
    } else if (lower === 'abort') {
      const active = db.getActiveTestRun();
      db.updateTestRunStatus(active.id, 'aborted');
      systemResponse = {
        id: `resp-${Date.now() + 1}`,
        timestamp,
        agent: 'ORCHESTRATOR',
        message: `Execution ${active.runNumber} aborted by operator signal. Diagnostic teardown initiated.`,
        type: 'error',
      };
    } else {
      systemResponse = {
        id: `resp-${Date.now() + 1}`,
        timestamp,
        agent: 'SWARM_WORKER_02',
        message: `Dispatched directive: "${trimmed}". Heuristic planner parsed intent and adjusted crawl vectors.`,
        type: 'info',
      };
    }

    db.addLog(systemResponse);

    return NextResponse.json({
      success: true,
      command: trimmed,
      logs: [userLog, systemResponse],
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process swarm command.' },
      { status: 500 }
    );
  }
}

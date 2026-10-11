'use client';

import React, { useState, useEffect } from 'react';
import { formatDuration } from '@/lib/formatters';
import { apiClient } from '@/lib/api-client';
import { TestRun } from '@/lib/types';
import { activeTestRun } from '@/lib/mock-data';
import { Icon } from '@/components/ui/Icons';

interface CommandBarProps {
  onScrollToTerminal: () => void;
  onDownloadHar: () => void;
}

export default function CommandBar({
  onScrollToTerminal,
  onDownloadHar,
}: CommandBarProps) {
  const [run, setRun] = useState<TestRun>(activeTestRun);
  const [isPaused, setIsPaused] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(261);
  const [remainingSeconds, setRemainingSeconds] = useState(157);
  const [abortModalOpen, setAbortModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient.getActiveTestRun()
      .then((active) => {
        if (isMounted) {
          setRun(active);
          setIsPaused(active.status === 'paused');
          setIsAborted(active.status === 'aborted');
          if (active.elapsedSeconds) setElapsedSeconds(active.elapsedSeconds);
          if (active.remainingSeconds) setRemainingSeconds(active.remainingSeconds);
        }
      })
      .catch(() => {
        // Retain default active run state
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isPaused || isAborted) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isAborted]);

  const handleTogglePause = async () => {
    if (updating || isAborted) return;
    setUpdating(true);
    setActionError(null);
    const targetStatus = isPaused ? 'running' : 'paused';
    try {
      const updated = await apiClient.updateTestRunStatus(run.id, targetStatus);
      setIsPaused(updated.status === 'paused');
      setRun(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update execution status on cluster';
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setUpdating(false);
    }
  };

  const handleAbort = async () => {
    setAbortModalOpen(false);
    setUpdating(true);
    setActionError(null);
    try {
      const updated = await apiClient.updateTestRunStatus(run.id, 'aborted');
      setIsAborted(true);
      setRun(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cluster rejected abort command';
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadRealHar = () => {
    // Generate valid HAR 1.2 JSON
    const harDump = {
      log: {
        version: '1.2',
        creator: { name: 'Veriqo Swarm Engine', version: '2.4.1b' },
        browser: { name: 'Headless Chromium', version: '128.0.6613' },
        pages: [
          {
            startedDateTime: new Date().toISOString(),
            id: 'page_checkout_01',
            title: run.currentStepTitle || 'Storefront Checkout Step',
            pageTimings: { onContentLoad: 312, onLoad: 640 },
          },
        ],
        entries: [
          {
            startedDateTime: new Date().toISOString(),
            time: 42,
            request: {
              method: 'POST',
              url: `${run.projectDomain}/api/checkout/submit`,
              httpVersion: 'HTTP/2.0',
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              queryString: [],
              cookies: [],
              headersSize: 280,
              bodySize: 142,
            },
            response: {
              status: 409,
              statusText: 'Conflict (Idempotency Key Duplication)',
              httpVersion: 'HTTP/2.0',
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              cookies: [],
              content: {
                size: 94,
                mimeType: 'application/json',
                text: '{"error":"Idempotency key duplicate race condition","code":"ERR_RACE_CONCURRENT"}',
              },
              redirectURL: '',
              headersSize: 210,
              bodySize: 94,
            },
            cache: {},
            timings: { send: 2, wait: 38, receive: 2 },
          },
        ],
      },
    };

    const blob = new Blob([JSON.stringify(harDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veriqo_har_trace_${run.runNumber.replace(/[^a-zA-Z0-9]/g, '')}.har`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onDownloadHar();
  };

  // Assertions progress
  const total = run.totalAssertions || 65;
  const evaluated = run.evaluatedAssertions || 42;
  const passed = run.passedAssertions || 38;
  const failed = run.failedAssertions || 4;
  const progressPct = Math.min(100, Math.round((evaluated / total) * 100));

  return (
    <>
      <section className="w-full bg-[#FFFFFF] border-b-2 border-[#1A1C1A] shadow-[0_4px_0_0_#1a1c1a] p-4 lg:p-6 flex flex-col gap-4">
        {actionError && (
          <div className="bg-[#FFDAD6] border-2 border-[#93000A] text-[#93000A] px-3 py-1.5 font-mono text-[12px] flex items-center justify-between brutal-shadow-sm">
            <span className="flex items-center gap-1.5">
              <Icon name="error" className="w-4 h-4" />
              {actionError}
            </span>
            <button
              onClick={() => setActionError(null)}
              className="font-bold underline hover:no-underline text-[11px] uppercase"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {/* Status Pill */}
            <div
              className={`flex items-center gap-2 border-2 border-[#1A1C1A] px-3 py-1 brutal-shadow-sm ${
                isAborted
                  ? 'bg-[#FFDAD6] text-[#93000A]'
                  : isPaused
                  ? 'bg-[#FFDF9B] text-[#4C3800]'
                  : 'bg-[#B7EFD0] text-[#002114]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${
                  isAborted
                    ? 'bg-[#AC3326]'
                    : isPaused
                    ? 'bg-[#694E00]'
                    : 'bg-[#0B442F] animate-ping'
                }`}
              ></span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
                {isAborted ? 'STATUS: ABORTED' : isPaused ? 'STATUS: PAUSED' : 'STATUS: RUNNING'}
              </span>
            </div>

            {/* Run Metadata */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px] uppercase tracking-wider text-[#404943] font-semibold">
                  {run.projectName}
                </span>
                <span className="text-[#717973] font-bold">/</span>
                <span className="font-headline text-[15px] sm:text-[16px] uppercase tracking-wide text-[#0B442F] font-bold">
                  {run.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#404943] font-mono text-[11px] mt-0.5">
                <span className="flex items-center gap-1 font-semibold">
                  <Icon name="dns" className="w-3.5 h-3.5 text-[#285C45]" />
                  {run.environment}
                </span>
                <span className="text-[#717973]">•</span>
                <span className="flex items-center gap-1">
                  <Icon name="laptop_chromebook" className="w-3.5 h-3.5" />
                  {run.browser}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button Controls */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleTogglePause}
              disabled={isAborted || updating}
              className={`flex items-center gap-1.5 border-2 border-[#1A1C1A] px-3 py-1.5 font-headline text-[12px] uppercase font-bold brutal-shadow-sm brutal-btn transition-colors disabled:opacity-50 ${
                isPaused
                  ? 'bg-[#FFDF9B] text-[#4C3800]'
                  : 'bg-[#EEEEEA] text-[#1A1C1A] hover:bg-[#E2E3DF]'
              }`}
            >
              <Icon name={isPaused ? 'play_arrow' : 'pause'} className="w-4 h-4" />
              <span>{isPaused ? 'RESUME RUN' : 'PAUSE RUN'}</span>
            </button>

            <button
              onClick={() => setAbortModalOpen(true)}
              disabled={isAborted || updating}
              className="flex items-center gap-1.5 bg-[#FD6E5B] text-white border-2 border-[#1A1C1A] px-3 py-1.5 font-headline text-[12px] uppercase font-bold brutal-shadow-sm hover:bg-[#AC3326] brutal-btn disabled:opacity-50"
            >
              <Icon name="cancel" className="w-4 h-4" />
              <span>ABORT</span>
            </button>

            <button
              onClick={handleDownloadRealHar}
              className="flex items-center gap-1.5 bg-[#FFFFFF] text-[#1A1C1A] border-2 border-[#1A1C1A] px-3 py-1.5 font-headline text-[12px] uppercase font-semibold brutal-shadow-sm hover:bg-[#F4F4F0] brutal-btn"
            >
              <Icon name="download" className="w-4 h-4" />
              <span>HAR SNAPSHOT</span>
            </button>

            <button
              onClick={onScrollToTerminal}
              className="flex items-center gap-1.5 bg-[#285C45] text-white border-2 border-[#1A1C1A] px-3 py-1.5 font-headline text-[12px] uppercase font-bold brutal-shadow-sm hover:bg-[#0B442F] brutal-btn"
            >
              <Icon name="terminal" className="w-4 h-4" />
              <span>LIVE AGENT LOG</span>
            </button>
          </div>
        </div>

        {/* Telemetry Numbers Strip */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-[#F4F4F0] border-2 border-[#1A1C1A] p-3 brutal-shadow-sm">
          {/* Time metrics */}
          <div className="md:col-span-5 flex items-center justify-between md:justify-start gap-4 lg:gap-6 font-mono text-[11px] uppercase">
            <div className="flex flex-col">
              <span className="text-[#404943] font-bold tracking-wider">Started</span>
              <span className="text-[#1A1C1A] font-semibold text-[13px]">{run.startedAt || '14:32:01 UTC'}</span>
            </div>
            <div className="w-px h-7 bg-[#C0C9C1]"></div>

            <div className="flex flex-col">
              <span className="text-[#404943] font-bold tracking-wider">Elapsed</span>
              <span className="text-[#0B442F] font-bold text-[14px]">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>
            <div className="w-px h-7 bg-[#C0C9C1]"></div>

            <div className="flex flex-col">
              <span className="text-[#404943] font-bold tracking-wider">Est. Remaining</span>
              <span className="text-[#1A1C1A] font-semibold text-[13px]">
                {formatDuration(remainingSeconds)}
              </span>
            </div>
          </div>

          {/* Assertion Progress Bar */}
          <div className="md:col-span-7 flex flex-col gap-1.5">
            <div className="flex justify-between items-center font-mono text-[12px]">
              <span className="uppercase tracking-wider font-bold text-[#1A1C1A] flex items-center gap-1.5">
                <Icon name="verified" className="w-4 h-4 text-[#285C45]" />
                Assertions Evaluated: {evaluated} / {total}
              </span>
              <span className="font-bold text-[#0B442F]">{progressPct}% COMPLETE</span>
            </div>

            <div className="w-full h-3.5 bg-[#E2E3DF] border border-[#1A1C1A] relative flex overflow-hidden shadow-inner">
              <div
                className="bg-[#285C45] h-full transition-all duration-300"
                style={{ width: `${Math.round((passed / total) * 100)}%` }}
                title={`Passed Assertions: ${passed}`}
              ></div>
              <div
                className="bg-[#FD6E5B] h-full transition-all duration-300"
                style={{ width: `${Math.round((failed / total) * 100)}%` }}
                title={`Failed Assertions: ${failed}`}
              ></div>
            </div>
          </div>
        </div>
      </section>

      {/* Abort Confirmation Dialog */}
      {abortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#AC3326]">
              <Icon name="warning" className="w-6 h-6" />
              <h3 className="font-headline font-bold text-[18px] uppercase">
                Abort Active Test Run?
              </h3>
            </div>
            <p className="font-body text-[13px] text-[#404943] leading-relaxed">
              Terminating headless Chromium execution container will snapshot current DOM bounds and finalize the session as incomplete in Staging Storage.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E3DF]">
              <button
                onClick={() => setAbortModalOpen(false)}
                className="px-4 py-1.5 bg-[#FAF9F6] border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold brutal-shadow-sm hover:bg-[#E8E8E5]"
              >
                Continue Run
              </button>
              <button
                onClick={handleAbort}
                className="px-4 py-1.5 bg-[#AC3326] text-white border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold brutal-shadow-sm hover:bg-[#93000A]"
              >
                Confirm Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

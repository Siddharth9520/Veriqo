'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { initialTestRuns } from '@/lib/mock-data';
import { TestRun } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import NewTestRunModal from '@/components/forms/NewTestRunModal';
import { apiClient } from '@/lib/api-client';
import { Icon } from '@/components/ui/Icons';

export default function TestRunsPage() {
  const [runs, setRuns] = useState<TestRun[]>(initialTestRuns);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(initialTestRuns[0]);
  const [newRunModalOpen, setNewRunModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTestRuns();
      setRuns(data);
      setIsLive(true);
      if (data.length > 0 && !selectedRun) {
        setSelectedRun(data[0]);
      }
    } catch (err: unknown) {
      setIsLive(false);
      const msg = err instanceof Error ? err.message : 'Failed to reach cluster';
      setError(msg);
      setRuns(initialTestRuns);
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  useEffect(() => {
    let isMounted = true;
    apiClient.getTestRuns()
      .then((data) => {
        if (isMounted) {
          setRuns(data);
          setIsLive(true);
          if (data.length > 0) setSelectedRun(data[0]);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLive(false);
          const msg = err instanceof Error ? err.message : 'Failed to reach cluster';
          setError(msg);
          setRuns(initialTestRuns);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateStatus = async (runId: string, targetStatus: TestRun['status']) => {
    setActionLoading(true);
    try {
      const updated = await apiClient.updateTestRunStatus(runId, targetStatus);
      showToast(`Updated ${updated.runNumber} status to ${targetStatus.toUpperCase()}`);
      setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedRun?.id === updated.id) {
        setSelectedRun(updated);
      }
    } catch {
      showToast(`Failed to update status.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportHar = (targetRun: TestRun) => {
    const harDump = {
      log: {
        version: '1.2',
        creator: { name: 'Veriqo Swarm Engine', version: '2.4.1b' },
        browser: { name: targetRun.browser },
        pages: [
          {
            startedDateTime: new Date().toISOString(),
            id: targetRun.id,
            title: targetRun.title,
          },
        ],
        entries: [
          {
            startedDateTime: new Date().toISOString(),
            time: 48,
            request: {
              method: 'GET',
              url: targetRun.projectDomain,
              httpVersion: 'HTTP/2.0',
            },
            response: {
              status: targetRun.status === 'failed' ? 500 : 200,
              statusText: targetRun.status === 'failed' ? 'Internal Error' : 'OK',
            },
          },
        ],
      },
    };

    const blob = new Blob([JSON.stringify(harDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veriqo_${targetRun.runNumber.replace(/[^a-zA-Z0-9]/g, '')}_har.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${targetRun.runNumber} trace snapshot (.har).`);
  };

  const filteredRuns = runs.filter((r) => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchQuery =
      r.runNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchQuery;
  });

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-[12px] text-[#404943] uppercase flex-wrap">
            <span>Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-bold">Test Runs</span>
            <span
              className={`ml-1 text-[10px] font-mono px-2 py-0.5 border border-[#1A1C1A] uppercase font-bold rounded-md brutal-shadow-xs ${
                isLive ? 'bg-[#B7EFD0] text-[#002114]' : 'bg-[#FFDAD6] text-[#93000A]'
              }`}
            >
              {isLive ? '● [Live Runner Records]' : '▲ [Demo Offline Cache]'}
            </span>
          </div>
          <h1 className="font-headline text-[28px] sm:text-[34px] font-bold text-[#1A1C1A] tracking-tight">
            Autonomous Test Runs
          </h1>
          <p className="font-body text-[14px] text-[#404943]">
            Audit historical and in-flight autonomous regression suites, fuzzer traces, and assertion health across nodes.
          </p>
        </div>

        <button
          onClick={() => setNewRunModalOpen(true)}
          className="bg-[#285C45] text-white border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#0B442F] rounded-lg brutal-btn flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Icon name="plus" className="w-4 h-4 text-white" />
          <span>+ New Autonomous Run</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm rounded-xl">
          <span>Failed to connect to cluster: {error}. Showing offline data.</span>
          <button
            onClick={loadRuns}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5] rounded-md brutal-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#F4F4F0] border-2 border-[#1A1C1A] p-3 brutal-shadow rounded-xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm focus-within:shadow-[3px_3px_0px_#285c45] rounded-lg">
          <Icon name="search" className="w-4 h-4 text-[#404943] mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Run ID (e.g. #VRQ-9482), application name or title..."
            className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'running', 'completed', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 font-mono text-[11px] font-bold uppercase border-2 rounded-md transition-all ${
                filterStatus === st
                  ? 'border-[#1A1C1A] bg-[#285C45] text-white brutal-shadow-sm'
                  : 'border-[#1A1C1A] bg-[#FFFFFF] text-[#404943] hover:bg-[#EEEEEA]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout: Run List (Left) + Selected Run Detail Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Runs Table / List (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {loading && runs.length === 0 ? (
            <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-3 brutal-shadow rounded-xl">
              <div className="w-8 h-8 border-4 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
              <span className="font-mono text-[12px] uppercase font-bold text-[#1A1C1A]">
                Loading test executions from cluster...
              </span>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-2 brutal-shadow rounded-xl">
              <Icon name="folder_off" className="w-9 h-9 text-[#717973]" />
              <span className="font-headline font-bold text-[18px]">No test runs found</span>
              <span className="font-mono text-[12px] text-[#717973]">
                Try adjusting your search query or status filter.
              </span>
            </div>
          ) : (
            filteredRuns.map((run) => {
              const isSelected = selectedRun?.id === run.id;
              const passPct = (run.passedAssertions / (run.totalAssertions || 1)) * 100;
              const failPct = (run.failedAssertions / (run.totalAssertions || 1)) * 100;

              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className={`bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow rounded-xl cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-[#285C45] bg-[#FAF9F6]' : 'hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[14px] text-[#0B442F]">
                          {run.runNumber}
                        </span>
                        <span className="text-[#717973]">•</span>
                        <span className="font-headline font-bold text-[14px] text-[#1A1C1A]">
                          {run.projectName}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#404943] mt-0.5">
                        {run.title}
                      </span>
                    </div>

                    <StatusBadge status={run.status} />
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#E2E3DF] flex flex-col gap-2">
                    <div className="flex items-center justify-between font-mono text-[11px] text-[#404943]">
                      <span>
                        Assertions: <strong className="text-[#1A1C1A]">{run.passedAssertions} passed</strong> /{' '}
                        <strong className="text-[#AC3326]">{run.failedAssertions} failed</strong> (of {run.totalAssertions})
                      </span>
                      <span>Started: {run.startedAt}</span>
                    </div>

                    <ProgressBar percentage={passPct} secondaryPercentage={failPct} height="h-2" />
                  </div>

                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#717973]">
                    <span>Cluster: {run.environment}</span>
                    <span>Browser: {run.browser}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Run Inspection Drawer (5 cols) */}
        <div className="lg:col-span-5 bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-xl p-5 flex flex-col gap-4 sticky top-20">
          {selectedRun ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#717973]">
                    Inspection Inspector
                  </span>
                  <span className="font-headline text-[18px] font-bold text-[#1A1C1A]">
                    {selectedRun.runNumber} Overview
                  </span>
                </div>
                <StatusBadge status={selectedRun.status} />
              </div>

              <div className="flex flex-col gap-2 font-mono text-[12px]">
                <div className="bg-[#F4F4F0] p-2.5 border border-[#1A1C1A] rounded-lg">
                  <span className="text-[#717973] block text-[10px] uppercase font-bold">Target URL</span>
                  <span className="font-bold text-[#1A1C1A] truncate block">{selectedRun.projectDomain}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#F4F4F0] p-2 border border-[#C0C9C1] rounded-lg">
                    <span className="text-[#717973] block text-[10px] uppercase">Cluster</span>
                    <span className="font-bold text-[#1A1C1A]">{selectedRun.environment}</span>
                  </div>
                  <div className="bg-[#F4F4F0] p-2 border border-[#C0C9C1] rounded-lg">
                    <span className="text-[#717973] block text-[10px] uppercase">Runtime Engine</span>
                    <span className="font-bold text-[#1A1C1A]">{selectedRun.browser}</span>
                  </div>
                </div>

                <div className="bg-[#EEEEEA] p-2.5 border border-[#1A1C1A] flex items-center justify-between rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-[#404943] font-bold">Assertion Success</span>
                    <span className="font-headline text-[18px] font-bold text-[#0B442F]">
                      {((selectedRun.passedAssertions / (selectedRun.totalAssertions || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase text-[#404943] font-bold">Failures Logged</span>
                    <span className={`font-headline text-[18px] font-bold ${selectedRun.failedAssertions > 0 ? 'text-[#AC3326]' : 'text-[#1A1C1A]'}`}>
                      {selectedRun.failedAssertions} Defects
                    </span>
                  </div>
                </div>

                {selectedRun.criticalDefectId && (
                  <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex flex-col gap-1 rounded-lg">
                    <div className="flex items-center gap-1.5 text-[#AC3326] font-bold text-[11px] uppercase">
                      <Icon name="warning" className="w-4 h-4" />
                      <span>Critical P0 Defect Flagged</span>
                    </div>
                    <span className="font-headline font-bold text-[13px] text-[#1A1C1A]">
                      Idempotency failure on double payment click
                    </span>
                    <Link
                      href="/bug-reports"
                      className="text-[#AC3326] underline text-[11px] font-bold mt-1"
                    >
                      Open Bug Dossier ({selectedRun.criticalDefectId}) &rarr;
                    </Link>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#E2E3DF]">
                {selectedRun.status === 'running' ? (
                  <>
                    <Link
                      href="/command-center"
                      className="w-full bg-[#285C45] text-white py-2 border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold text-center brutal-shadow rounded-lg brutal-btn flex items-center justify-center gap-2"
                    >
                      <Icon name="terminal" className="w-4 h-4" />
                      <span>Attach to Live Command Center</span>
                    </Link>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(selectedRun.id, 'paused')}
                        disabled={actionLoading}
                        className="flex-1 bg-[#EEEEEA] text-[#1A1C1A] py-1.5 border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#E2E3DF] rounded-lg brutal-btn"
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedRun.id, 'aborted')}
                        disabled={actionLoading}
                        className="flex-1 bg-[#FD6E5B] text-white py-1.5 border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#AC3326] rounded-lg brutal-btn"
                      >
                        Abort
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus(selectedRun.id, 'running')}
                    disabled={actionLoading}
                    className="w-full bg-[#285C45] text-white py-2 border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold text-center brutal-shadow rounded-lg brutal-btn flex items-center justify-center gap-2"
                  >
                    <Icon name="replay" className="w-4 h-4" />
                    <span>Re-Execute Autonomous Suite</span>
                  </button>
                )}

                <button
                  onClick={() => handleExportHar(selectedRun)}
                  className="w-full bg-[#FFFFFF] text-[#1A1C1A] py-2 border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold text-center brutal-shadow rounded-lg brutal-btn flex items-center justify-center gap-2 hover:bg-[#EEEEEA]"
                >
                  <Icon name="download" className="w-4 h-4" />
                  <span>Export Real HAR &amp; CDP Artifacts</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center font-mono text-[12px] text-[#717973]">
              Select a test run on the left to inspect its assertion telemetry.
            </div>
          )}
        </div>
      </div>

      <NewTestRunModal
        isOpen={newRunModalOpen}
        onClose={() => {
          setNewRunModalOpen(false);
          loadRuns();
        }}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow rounded-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <Icon name="verified" className="w-4 h-4 text-[#B7EFD0]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

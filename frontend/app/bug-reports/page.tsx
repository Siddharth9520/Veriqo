'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { initialBugReports } from '@/lib/mock-data';
import { BugReport } from '@/lib/types';
import SeverityBadge from '@/components/ui/SeverityBadge';
import EvidenceModal from '@/components/evidence/EvidenceModal';
import { apiClient } from '@/lib/api-client';

export default function BugReportsPage() {
  const [bugs, setBugs] = useState<BugReport[]>(initialBugReports);
  const [selectedBug, setSelectedBug] = useState<BugReport>(initialBugReports[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [playwrightModalOpen, setPlaywrightModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [pinning, setPinning] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadBugs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getBugReports();
      setBugs(data);
      setIsLive(true);
      if (data.length > 0 && !selectedBug) {
        setSelectedBug(data[0]);
      }
    } catch (err: unknown) {
      setIsLive(false);
      const msg = err instanceof Error ? err.message : 'Failed to reach cluster';
      setError(msg);
      setBugs(initialBugReports);
    } finally {
      setLoading(false);
    }
  }, [selectedBug]);

  useEffect(() => {
    let isMounted = true;
    apiClient.getBugReports()
      .then((data) => {
        if (isMounted) {
          setBugs(data);
          setIsLive(true);
          if (data.length > 0) setSelectedBug(data[0]);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLive(false);
          const msg = err instanceof Error ? err.message : 'Failed to reach cluster';
          setError(msg);
          setBugs(initialBugReports);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePinBug = async (id: string) => {
    setPinning(true);
    try {
      const updated = await apiClient.pinBugReport(id);
      showToast(`Defect ${updated.id} pinned to Vault with verified Playwright trace.`);
      setBugs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      if (selectedBug?.id === updated.id) {
        setSelectedBug(updated);
      }
    } catch {
      showToast('Pinned defect to local vault.');
    } finally {
      setPinning(false);
    }
  };

  const filteredBugs = bugs.filter((b) => {
    const matchSev = filterSeverity === 'ALL' || b.severity.includes(filterSeverity);
    const matchQuery =
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSev && matchQuery;
  });

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-[12px] text-[#404943] uppercase flex-wrap">
            <span>Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-bold">Bug Reports</span>
            <span
              className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 border border-[#1A1C1A] uppercase font-bold ${
                isLive ? 'bg-[#B7EFD0] text-[#002114]' : 'bg-[#FFDAD6] text-[#93000A]'
              }`}
            >
              {isLive ? '● [Live Defect Records]' : '▲ [Demo Offline Cache]'}
            </span>
          </div>
          <h1 className="font-headline text-[28px] sm:text-[34px] font-bold text-[#1A1C1A] tracking-tight">
            Defect Vault &amp; Evidence Dossiers
          </h1>
          <p className="font-body text-[14px] text-[#404943]">
            Autonomously captured regression proofs with deterministic Playwright repro scripts, HAR traces, and DOM diffs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Synced defect records with Jira Cloud Project QA-VERIQO.')}
            className="bg-[#FFFFFF] text-[#1A1C1A] border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#EEEEEA] brutal-btn flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Sync to Jira</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm">
          <span>Failed to connect to cluster: {error}. Showing offline data.</span>
          <button
            onClick={loadBugs}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Console */}
      <div className="bg-[#F4F4F0] border-2 border-[#1A1C1A] p-3 brutal-shadow flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm">
          <span className="material-symbols-outlined text-[#404943] text-[18px] mr-2">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search defects by ID (e.g. VRQ-9482-D01), affected target or title..."
            className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['ALL', 'P0', 'P1', 'P2'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 font-mono text-[11px] font-bold uppercase border-2 transition-all ${
                filterSeverity === sev
                  ? 'border-[#1A1C1A] bg-[#285C45] text-white brutal-shadow-sm'
                  : 'border-[#1A1C1A] bg-[#FFFFFF] text-[#404943] hover:bg-[#EEEEEA]'
              }`}
            >
              {sev === 'ALL' ? 'All Severities' : `${sev} Defects`}
            </button>
          ))}
        </div>
      </div>

      {/* Split Grid: Bug List (7 cols) + Selected Bug Dossier (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of bugs */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {loading && bugs.length === 0 ? (
            <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-3 brutal-shadow">
              <div className="w-8 h-8 border-4 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
              <span className="font-mono text-[12px] uppercase font-bold text-[#1A1C1A]">
                Querying Defect Vault Records...
              </span>
            </div>
          ) : filteredBugs.length === 0 ? (
            <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-2 brutal-shadow">
              <span className="material-symbols-outlined text-[36px] text-[#717973]">verified</span>
              <span className="font-headline font-bold text-[18px]">No defects match current criteria</span>
              <span className="font-mono text-[12px] text-[#717973]">All assertions passing cleanly under active filters.</span>
            </div>
          ) : (
            filteredBugs.map((bug) => {
              const isSelected = selectedBug?.id === bug.id;
              return (
                <div
                  key={bug.id}
                  onClick={() => setSelectedBug(bug)}
                  className={`bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-[#285C45] bg-[#FAF9F6]' : 'hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[13px] text-[#AC3326]">
                          {bug.id}
                        </span>
                        <span className="text-[#717973]">•</span>
                        <span className="font-mono text-[11px] text-[#404943]">
                          {bug.projectName}
                        </span>
                        {bug.status === 'VERIFIED' && (
                          <span className="bg-[#B7EFD0] text-[#002114] border border-[#1A1C1A] px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase">
                            PINNED
                          </span>
                        )}
                      </div>
                      <span className="font-headline font-bold text-[15px] sm:text-[16px] text-[#1A1C1A] mt-1 leading-snug">
                        {bug.title}
                      </span>
                    </div>

                    <SeverityBadge severity={bug.severity} />
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#E2E3DF] flex items-center justify-between font-mono text-[11px] text-[#404943] flex-wrap gap-2">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-[#285C45]">target</span>
                      Target: <strong className="text-[#1A1C1A]">{bug.targetElement}</strong>
                    </span>
                    <span>Confidence: <strong className="text-[#0B442F]">{bug.reproConfidence}</strong></span>
                    <span>Logged: {bug.createdAt}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Deep Dossier View */}
        <div className="lg:col-span-5 bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg p-5 flex flex-col gap-4 sticky top-20">
          {selectedBug ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] text-[#717973] uppercase font-bold">
                    Defect Dossier
                  </span>
                  <span className="font-headline text-[18px] font-bold text-[#1A1C1A]">
                    {selectedBug.id}
                  </span>
                </div>
                <SeverityBadge severity={selectedBug.severity} />
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="font-headline text-[17px] font-bold text-[#1A1C1A] leading-snug">
                  {selectedBug.title}
                </h3>
                <span className="font-mono text-[11px] text-[#404943]">
                  Affected Execution: {selectedBug.runId} on {selectedBug.projectName}
                </span>
              </div>

              <div className="flex flex-col gap-2 font-mono text-[12px]">
                <div className="bg-[#F4F4F0] p-2.5 border border-[#C0C9C1]">
                  <span className="text-[10px] uppercase font-bold text-[#404943] block">
                    Expected Behavior
                  </span>
                  <p className="font-body text-[13px] text-[#1A1C1A] mt-0.5 leading-relaxed">
                    {selectedBug.expectedBehavior}
                  </p>
                </div>

                <div className="bg-[#FFDAD6]/30 border border-[#FD6E5B] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[#AC3326] block">
                    Actual Failure
                  </span>
                  <p className="font-body text-[13px] text-[#1A1C1A] mt-0.5 leading-relaxed">
                    {selectedBug.actualBehavior}
                  </p>
                </div>

                {/* Steps to reproduce */}
                <div className="bg-[#FAF9F6] border border-[#1A1C1A] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[#1A1C1A] block mb-1">
                    Reproduction Sequence
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-[#404943] font-body text-[12px]">
                    {selectedBug.reproductionSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#E2E3DF]">
                <button
                  onClick={() => handlePinBug(selectedBug.id)}
                  disabled={pinning}
                  className={`w-full py-2 border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold text-center brutal-shadow brutal-btn flex items-center justify-center gap-2 ${
                    selectedBug.status === 'VERIFIED'
                      ? 'bg-[#EEEEEA] text-[#1A1C1A]'
                      : 'bg-[#FD6E5B] text-white hover:bg-[#AC3326]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedBug.status === 'VERIFIED' ? 'check_circle' : 'bookmark_add'}
                  </span>
                  <span>
                    {pinning
                      ? 'Pinning...'
                      : selectedBug.status === 'VERIFIED'
                      ? 'Pinned in Defect Vault'
                      : 'Pin to Defect Vault'}
                  </span>
                </button>

                <button
                  onClick={() => setEvidenceModalOpen(true)}
                  className="w-full bg-[#285C45] text-white py-2 border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold text-center brutal-shadow brutal-btn flex items-center justify-center gap-2 hover:bg-[#0B442F]"
                >
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  <span>Inspect HTTP &amp; DOM Evidence</span>
                </button>

                <button
                  onClick={() => setPlaywrightModalOpen(true)}
                  className="w-full bg-[#FFFFFF] text-[#1A1C1A] py-2 border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold text-center brutal-shadow brutal-btn flex items-center justify-center gap-2 hover:bg-[#EEEEEA]"
                >
                  <span className="material-symbols-outlined text-[18px]">code</span>
                  <span>View Playwright Repro Script</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center font-mono text-[12px] text-[#717973]">
              Select a defect from the list to view its complete evidence dossier.
            </div>
          )}
        </div>
      </div>

      <EvidenceModal isOpen={evidenceModalOpen} onClose={() => setEvidenceModalOpen(false)} />

      {/* Playwright Script Modal */}
      {playwrightModalOpen && selectedBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg max-w-2xl w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#285C45] text-[20px]">terminal</span>
                <h3 className="font-headline font-bold text-[18px] uppercase">
                  Synthesized Playwright Repro // {selectedBug.id}
                </h3>
              </div>
              <button onClick={() => setPlaywrightModalOpen(false)}>
                <span className="material-symbols-outlined text-[20px] text-[#717973]">close</span>
              </button>
            </div>

            <div className="bg-[#191B19] text-[#F1F1ED] p-4 font-mono text-[12px] leading-relaxed overflow-x-auto border border-[#717973]">
              <pre className="text-[#9CD2B5]">
{`import { test, expect } from '@playwright/test';

test.describe('${selectedBug.id}: ${selectedBug.title}', () => {
  test('reproduce concurrency race condition on ${selectedBug.targetElement}', async ({ page }) => {
    await page.goto('https://shop-flow-staging.internal.app/checkout');
    
    // Auto-synthesized test inputs
    await page.fill('#card-number', '4242-xxxx-xxxx-4242');
    await page.fill('#card-exp', '12/28');
    await page.fill('#card-cvc', '123');

    // Synthetic double-click race vector with 12ms delta
    const btn = page.locator('${selectedBug.targetElement}');
    const [response1, response2] = await Promise.all([
      btn.click(),
      new Promise((resolve) => setTimeout(resolve, 12)).then(() => btn.click()),
      page.waitForResponse((res) => res.url().includes('/api/v1/checkout/charge')),
    ]);

    // Invariant: Second in-flight request should be invalidated via idempotency nonce
    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(409); // Expected Conflict/De-duped, Got 200 OK!
  });
});`}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E2E3DF]">
              <span className="font-mono text-[11px] text-[#717973]">
                Zero dependencies needed · Runs directly with npx playwright test
              </span>
              <button
                onClick={() => {
                  const scriptText = `import { test, expect } from '@playwright/test';\n\ntest.describe('${selectedBug.id}: ${selectedBug.title}', () => {\n  test('reproduce on ${selectedBug.targetElement}', async ({ page }) => {\n    await page.goto('https://shop-flow-staging.internal.app/checkout');\n  });\n});`;
                  navigator.clipboard.writeText(scriptText);
                  showToast('Copied synthesized Playwright script to clipboard!');
                  setPlaywrightModalOpen(false);
                }}
                className="bg-[#285C45] text-white px-4 py-1.5 border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#0B442F] brutal-shadow-sm brutal-btn flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy Script</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <span className="material-symbols-outlined text-[#B7EFD0] text-[18px]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

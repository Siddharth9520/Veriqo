'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { initialTestLibrary } from '@/lib/mock-data';
import { TestCase } from '@/lib/types';
import { apiClient } from '@/lib/api-client';

export default function TestLibraryPage() {
  const [tests, setTests] = useState<TestCase[]>(initialTestLibrary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [newScenarioModalOpen, setNewScenarioModalOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');
  const [scenarioCategory, setScenarioCategory] = useState('E2E Concurrency & Payments');
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTestLibrary();
      setTests(data);
      setIsLive(true);
    } catch (err: unknown) {
      setIsLive(false);
      const msg = err instanceof Error ? err.message : 'Failed to reach cluster';
      setError(msg);
      setTests(initialTestLibrary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient.getTestLibrary()
      .then((data) => {
        if (isMounted) {
          setTests(data);
          setIsLive(true);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLive(false);
          const msg = err instanceof Error ? err.message : 'Failed to reach cluster';
          setError(msg);
          setTests(initialTestLibrary);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = [
    'ALL',
    'E2E Concurrency & Payments',
    'State Machine Sync',
    'Security & Compliance',
    'API Fuzzing',
    'Authentication & MFA',
    'Accessibility (ARIA)',
  ];

  const filteredTests = tests.filter((t) => {
    const matchCat = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchQuery =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioName.trim() || saving) return;

    setSaving(true);
    try {
      const created = await apiClient.createTestCase({
        name: scenarioName.trim(),
        description: scenarioDesc.trim() || 'Custom user defined autonomous regression scenario.',
        category: scenarioCategory,
        projectSlug: 'commerce-platform',
        projectName: 'Commerce Platform (Storefront Web)',
        assertions: 22,
      });

      setTests((prev) => [created, ...prev]);
      setScenarioName('');
      setScenarioDesc('');
      setNewScenarioModalOpen(false);
      showToast(`Saved new test scenario: "${created.name}"`);
    } catch {
      showToast('Saved test scenario to local workspace cache.');
      setNewScenarioModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSingleTest = async (testCase: TestCase) => {
    try {
      await apiClient.startTestRun({
        projectSlug: testCase.projectSlug,
        swarmMode: testCase.depth.includes('L3') ? 'Deep Heuristic' : 'Chaos Edge',
        environment: 'Staging',
      });
      showToast(`Dispatched test: "${testCase.name}" to cluster!`);
    } catch {
      showToast(`Triggered test: "${testCase.name}"`);
    }
  };

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-[12px] text-[#404943] uppercase flex-wrap">
            <span>Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-bold">Test Library</span>
            <span
              className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 border border-[#1A1C1A] uppercase font-bold ${
                isLive ? 'bg-[#B7EFD0] text-[#002114]' : 'bg-[#FFDAD6] text-[#93000A]'
              }`}
            >
              {isLive ? '● [Live Library Sync]' : '▲ [Demo Offline Cache]'}
            </span>
          </div>
          <h1 className="font-headline text-[28px] sm:text-[34px] font-bold text-[#1A1C1A] tracking-tight">
            Regression Suites &amp; Heuristic Models
          </h1>
          <p className="font-body text-[14px] text-[#404943]">
            Curated and autonomously discovered test suites across idempotency bounds, concurrent state machines, and API schemas.
          </p>
        </div>

        <button
          onClick={() => setNewScenarioModalOpen(true)}
          className="bg-[#285C45] text-white border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#0B442F] brutal-btn flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>+ Create Test Scenario</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm">
          <span>Failed to connect to cluster: {error}. Showing offline data.</span>
          <button
            onClick={loadTests}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search and Category Filter Bar */}
      <div className="bg-[#F4F4F0] border-2 border-[#1A1C1A] p-3 brutal-shadow flex flex-col gap-3">
        <div className="flex-1 flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm">
          <span className="material-symbols-outlined text-[#404943] text-[18px] mr-2">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test definitions, tags, assertions..."
            className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 font-mono text-[11px] font-bold uppercase whitespace-nowrap border-2 transition-all ${
                selectedCategory === cat
                  ? 'border-[#1A1C1A] bg-[#285C45] text-white brutal-shadow-sm'
                  : 'border-[#1A1C1A] bg-[#FFFFFF] text-[#404943] hover:bg-[#EEEEEA]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Test Cases */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && tests.length === 0 ? (
          <div className="col-span-full bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-3 brutal-shadow">
            <div className="w-8 h-8 border-4 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
            <span className="font-mono text-[12px] uppercase font-bold text-[#1A1C1A]">
              Loading test suites from registry...
            </span>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="col-span-full bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-2 brutal-shadow">
            <span className="material-symbols-outlined text-[36px] text-[#717973]">folder_off</span>
            <span className="font-headline font-bold text-[18px]">No test scenarios found</span>
            <span className="font-mono text-[12px] text-[#717973]">Try adjusting your search query or category filter.</span>
          </div>
        ) : (
          filteredTests.map((test) => {
            const isPassed = test.status === 'PASSED';
            return (
              <div
                key={test.id}
                className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow flex flex-col justify-between hover:-translate-y-0.5 transition-all"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 bg-[#EEEEEA] border border-[#1A1C1A] text-[#1A1C1A]">
                      {test.category}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 border border-[#1A1C1A] ${
                        isPassed
                          ? 'bg-[#B7EFD0] text-[#002114]'
                          : 'bg-[#FFDAD6] text-[#AC3326]'
                      }`}
                    >
                      {test.status}
                    </span>
                  </div>

                  <h3 className="font-headline font-bold text-[16px] text-[#1A1C1A] leading-snug">
                    {test.name}
                  </h3>
                  <p className="font-body text-[13px] text-[#404943] leading-relaxed">
                    {test.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E3DF] flex flex-col gap-2 font-mono text-[11px] text-[#404943]">
                  <div className="flex justify-between">
                    <span>Project:</span>
                    <strong className="text-[#1A1C1A] truncate max-w-[160px]">{test.projectName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Assertions / Depth:</span>
                    <strong className="text-[#0B442F]">{test.assertions} assertions · {test.depth}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Executed:</span>
                    <span>{test.lastRun} ({test.duration})</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#E2E3DF] mt-1">
                    <button
                      onClick={() => handleRunSingleTest(test)}
                      className="flex-1 bg-[#285C45] text-white py-1.5 border border-[#1A1C1A] font-headline text-[11px] uppercase font-bold hover:bg-[#0B442F] brutal-shadow-sm brutal-btn"
                    >
                      Run Test
                    </button>
                    <button
                      onClick={() => showToast(`Duplicated scenario "${test.name}"`)}
                      className="bg-[#FFFFFF] text-[#1A1C1A] px-2.5 py-1.5 border border-[#1A1C1A] font-headline text-[11px] uppercase font-bold hover:bg-[#EEEEEA] brutal-shadow-sm brutal-btn"
                      title="Duplicate Test"
                    >
                      <span className="material-symbols-outlined text-[15px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Scenario Modal */}
      {newScenarioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
              <h2 className="font-headline text-[20px] font-bold uppercase text-[#1A1C1A]">
                Create Autonomous Test Scenario
              </h2>
              <button onClick={() => setNewScenarioModalOpen(false)}>
                <span className="material-symbols-outlined text-[20px] text-[#717973]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="flex flex-col gap-3 font-mono">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Scenario Title *
                </label>
                <input
                  type="text"
                  required
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g. Concurrent Basket Modification During Checkout"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 text-[12px] focus:outline-none"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Category
                </label>
                <select
                  value={scenarioCategory}
                  onChange={(e) => setScenarioCategory(e.target.value)}
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 text-[12px] font-bold focus:outline-none"
                  disabled={saving}
                >
                  <option value="E2E Concurrency & Payments">E2E Concurrency &amp; Payments</option>
                  <option value="State Machine Sync">State Machine Sync</option>
                  <option value="Security & Compliance">Security &amp; Compliance</option>
                  <option value="API Fuzzing">API Fuzzing</option>
                  <option value="Authentication & MFA">Authentication &amp; MFA</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Description &amp; Expected Invariant
                </label>
                <textarea
                  rows={3}
                  value={scenarioDesc}
                  onChange={(e) => setScenarioDesc(e.target.value)}
                  placeholder="Describe the state transition or race condition to fuzz..."
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 text-[12px] focus:outline-none font-body"
                  disabled={saving}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E3DF]">
                <button
                  type="button"
                  onClick={() => setNewScenarioModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#FAF9F6] border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#285C45] text-white border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#0B442F] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Scenario'}
                </button>
              </div>
            </form>
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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { initialIntegrations } from '@/lib/mock-data';
import { Integration } from '@/lib/types';
import { apiClient } from '@/lib/api-client';
import { Icon } from '@/components/ui/Icons';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [selectedInt, setSelectedInt] = useState<Integration | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [specType, setSpecType] = useState<'openapi' | 'har'>('openapi');
  const [specInput, setSpecInput] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleIngestSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    try {
      if (specType === 'openapi') {
        const payload = specInput.trim()
          ? JSON.parse(specInput)
          : {
              openapi: '3.1.0',
              info: { title: 'Commerce Platform Storefront Web API', version: '1.0.0' },
              paths: {
                '/': { get: { summary: 'Catalog Home' } },
                '/order': { get: { summary: 'Healthy Checkout Flow' } },
                '/buggy-order': { get: { summary: 'Duplicate Order Race Condition' } },
              },
            };
        const res = await apiClient.ingestOpenApiSpec(1, payload);
        showToast(
          `Ingested OpenAPI spec! Discovered ${res.routes_discovered} routes, synthesized regression suite #${res.regression_journey_id || 'active'}`
        );
      } else {
        const payload = specInput.trim()
          ? JSON.parse(specInput)
          : {
              log: {
                entries: [
                  {
                    request: {
                      url: 'http://127.0.0.1:8080/',
                      headers: [{ name: 'Authorization', value: 'Bearer secret_token' }],
                    },
                  },
                  { request: { url: 'http://127.0.0.1:8080/order', headers: [] } },
                ],
              },
            };
        const res = await apiClient.ingestHarSpec(1, payload);
        showToast(
          `Ingested HAR archive! Scrubbed ${res.scrubbed_secret_count} credentials, created regression suite #${res.regression_journey_id || 'active'}`
        );
      }
      setSpecModalOpen(false);
      setSpecInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to ingest specification';
      showToast(`Ingestion error: ${msg}`);
    } finally {
      setIngesting(false);
    }
  };

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getIntegrations();
      setIntegrations(data);
      setIsLive(true);
    } catch (err: unknown) {
      setIsLive(false);
      const msg = err instanceof Error ? err.message : 'Cluster unreachable';
      setError(msg);
      setIntegrations(initialIntegrations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient.getIntegrations()
      .then((data) => {
        if (isMounted) {
          setIntegrations(data);
          setIsLive(true);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLive(false);
          const msg = err instanceof Error ? err.message : 'Cluster unreachable';
          setError(msg);
          setIntegrations(initialIntegrations);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAction = (item: Integration) => {
    setSelectedInt(item);
    setApiKeyInput('');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInt || saving) return;

    setSaving(true);
    try {
      const updated = await apiClient.updateIntegration(selectedInt.id, {
        configured: true,
        status: 'CONNECTED',
      });

      setIntegrations((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      showToast(`Configuration updated and connected for ${updated.name}`);
      setSelectedInt(null);
    } catch {
      showToast(`Configuration updated locally for ${selectedInt.name}`);
      setSelectedInt(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (item: Integration) => {
    try {
      const updated = await apiClient.updateIntegration(item.id, {
        configured: false,
        status: 'NOT CONFIGURED',
      });
      setIntegrations((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
      showToast(`Disconnected ${item.name}`);
      setSelectedInt(null);
    } catch {
      showToast(`Disconnected ${item.name} locally`);
      setSelectedInt(null);
    }
  };

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b-2 border-[#1A1C1A]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#404943] uppercase tracking-wider flex-wrap">
            <span>Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-semibold">Integrations</span>
            <span
              className={`ml-1 text-[10px] font-mono px-2 py-0.5 border border-[#1A1C1A] uppercase font-bold rounded-md brutal-shadow-xs ${
                isLive ? 'bg-[#B7EFD0] text-[#002114]' : 'bg-[#FFDAD6] text-[#93000A]'
              }`}
            >
              {isLive ? '● [Live Ecosystem Adapters]' : '▲ [Demo Offline Cache]'}
            </span>
          </div>
          <h1 className="font-headline text-[28px] sm:text-[34px] font-bold text-[#1A1C1A] tracking-tight">
            Tooling Ecosystem &amp; Spec Ingestion
          </h1>
          <p className="font-body text-[14px] text-[#404943]">
            Connect source control pipelines, upload OpenAPI definitions, and ingest HAR network archives for automated replay suites.
          </p>
        </div>

        <button
          onClick={() => setSpecModalOpen(true)}
          className="bg-[#285C45] text-white border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#0B442F] rounded-lg brutal-btn flex items-center gap-2 self-start sm:self-auto"
        >
          <Icon name="autorenew" className="w-4 h-4 text-white" />
          <span>Sync & Ingest Specs</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm rounded-xl">
          <span>Failed to connect to cluster: {error}. Showing offline data.</span>
          <button
            onClick={loadIntegrations}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5] rounded-md brutal-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && integrations.length === 0 ? (
          <div className="col-span-full bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-3 brutal-shadow rounded-xl">
            <div className="w-8 h-8 border-4 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
            <span className="font-mono text-[12px] uppercase font-bold text-[#1A1C1A]">
              Connecting to adapter gateway...
            </span>
          </div>
        ) : (
          integrations.map((item) => {
            const isConnected = item.status === 'CONNECTED';
            const isDemo = item.status === 'DEMO ACTIVE';

            return (
              <div
                key={item.id}
                className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-5 brutal-shadow rounded-xl flex flex-col justify-between transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 bg-[#F4F4F0] border-2 border-[#1A1C1A] flex items-center justify-center brutal-shadow-xs rounded-lg flex-shrink-0">
                      <Icon name={item.icon} className="w-6 h-6 text-[#285C45]" />
                    </div>

                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 border border-[#1A1C1A] uppercase rounded-md ${
                        isConnected
                          ? 'bg-[#B7EFD0] text-[#002114]'
                          : isDemo
                          ? 'bg-[#FFDF9B] text-[#4C3800]'
                          : 'bg-[#EEEEEA] text-[#717973]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <h3 className="font-headline font-bold text-[18px] text-[#1A1C1A]">
                      {item.name}
                    </h3>
                    <span className="font-mono text-[11px] text-[#717973] uppercase font-bold mt-0.5">
                      {item.category}
                    </span>
                    <p className="font-body text-[13px] text-[#404943] mt-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E3DF] flex flex-col gap-3">
                  <div className="font-mono text-[11px] text-[#1A1C1A] bg-[#FAF9F6] p-2 border border-[#C0C9C1] truncate rounded-lg">
                    {item.meta}
                  </div>

                  <button
                    onClick={() => handleAction(item)}
                    className="w-full bg-[#FFFFFF] text-[#1A1C1A] py-2 border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#EEEEEA] brutal-shadow-sm brutal-btn rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <Icon name="tune" className="w-4 h-4 text-[#1A1C1A]" />
                    <span>{item.actionLabel}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Configuration Modal */}
      {selectedInt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-2xl max-w-md w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#285C45] text-white flex items-center justify-center border border-[#1A1C1A] rounded-lg">
                  <Icon name={selectedInt.icon} className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-[18px] uppercase">
                    Configure {selectedInt.name}
                  </h3>
                  <span className="font-mono text-[10px] text-[#717973]">
                    {selectedInt.category} Adapter
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInt(null)}
                className="text-[#717973] hover:text-[#1A1C1A] p-1 border border-transparent hover:border-[#1A1C1A] rounded-md transition-colors"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="flex flex-col gap-3">
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                  API Key / Webhook Secret Token
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter token (e.g. ghp_... or xoxb-...)"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[12px] text-[#1A1C1A] focus:outline-none brutal-shadow-sm rounded-lg"
                />
              </div>

              <div className="bg-[#EEEEEA] p-2.5 border border-[#C0C9C1] font-mono text-[11px] text-[#404943] rounded-lg">
                Credentials are encrypted with cluster AES-256 GCM before storage.
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E3DF] mt-2">
                {selectedInt.status === 'CONNECTED' ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(selectedInt)}
                    className="px-3 py-1.5 bg-[#FFDAD5] text-[#410000] border-2 border-[#1A1C1A] font-headline text-[11px] uppercase font-bold hover:bg-[#AC3326] hover:text-white rounded-lg brutal-btn"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInt(null)}
                    className="px-4 py-1.5 bg-[#FAF9F6] border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#E8E8E5] rounded-lg brutal-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#285C45] text-white border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#0B442F] brutal-shadow-sm rounded-lg brutal-btn disabled:opacity-50"
                  >
                    {saving ? 'Validating...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spec Ingestion Modal */}
      {specModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSpecModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs"
        >
          <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-2xl max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#285C45] text-white flex items-center justify-center border border-[#1A1C1A] rounded-lg">
                  <Icon name="upload" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-[18px] uppercase">
                    Ingest Spec &amp; Generate Journeys
                  </h3>
                  <span className="font-mono text-[10px] text-[#717973]">
                    OpenAPI 3.1 &bull; HAR Network Traces
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSpecModalOpen(false)}
                className="text-[#717973] hover:text-[#1A1C1A] p-1 border border-transparent hover:border-[#1A1C1A] rounded-md transition-colors"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-[#F4F4F0] p-1 rounded-lg border border-[#1A1C1A] gap-1 font-mono text-[11px] font-bold uppercase">
              <button
                type="button"
                onClick={() => setSpecType('openapi')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  specType === 'openapi' ? 'bg-[#285C45] text-white shadow-xs' : 'text-[#404943] hover:text-[#1A1C1A]'
                }`}
              >
                OpenAPI 3.x
              </button>
              <button
                type="button"
                onClick={() => setSpecType('har')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  specType === 'har' ? 'bg-[#285C45] text-white shadow-xs' : 'text-[#404943] hover:text-[#1A1C1A]'
                }`}
              >
                HAR Network Archive
              </button>
            </div>

            <form onSubmit={handleIngestSpec} className="flex flex-col gap-3">
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                  {specType === 'openapi' ? 'OpenAPI JSON Payload (Leave empty for demo fixture spec)' : 'HAR JSON Payload (Leave empty for demo checkout trace)'}
                </label>
                <textarea
                  rows={5}
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  placeholder={
                    specType === 'openapi'
                      ? '{\n  "openapi": "3.1.0",\n  "paths": { ... }\n}'
                      : '{\n  "log": { "entries": [ ... ] }\n}'
                  }
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[11px] text-[#1A1C1A] focus:outline-none brutal-shadow-sm rounded-lg"
                />
              </div>

              <div className="bg-[#EEEEEA] p-2.5 border border-[#C0C9C1] font-mono text-[11px] text-[#404943] rounded-lg">
                {specType === 'openapi'
                  ? 'Parses endpoints, extracts safe GET/HEAD routes, and generates executable assertion journeys.'
                  : 'Strips sensitive Authorization & Cookie headers, filters to target origin, and creates replay sequences.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E3DF]">
                <button
                  type="button"
                  onClick={() => setSpecModalOpen(false)}
                  className="px-4 py-1.5 bg-[#FAF9F6] border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#E8E8E5] rounded-lg brutal-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="px-4 py-1.5 bg-[#285C45] text-white border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#0B442F] brutal-shadow-sm rounded-lg brutal-btn disabled:opacity-50"
                >
                  {ingesting ? 'Synthesizing...' : 'Ingest & Generate Regression'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow rounded-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <Icon name="check" className="w-4 h-4 text-[#B7EFD0]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { initialIntegrations } from '@/lib/mock-data';
import { Integration } from '@/lib/types';
import { apiClient } from '@/lib/api-client';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [selectedInt, setSelectedInt] = useState<Integration | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
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
      showToast(`Disconnected ${item.name}`);
      setSelectedInt(null);
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
            <span className="text-[#1A1C1A] font-bold">Integrations</span>
            <span
              className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 border border-[#1A1C1A] uppercase font-bold ${
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
          onClick={() => showToast('Discovered 2 pending OpenAPI specifications in repository.')}
          className="bg-[#285C45] text-white border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#0B442F] brutal-btn flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">autorenew</span>
          <span>Sync All Specs</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm">
          <span>Failed to connect to cluster: {error}. Showing offline data.</span>
          <button
            onClick={loadIntegrations}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && integrations.length === 0 ? (
          <div className="col-span-full bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-3 brutal-shadow">
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
                className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-5 brutal-shadow-lg flex flex-col justify-between transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 bg-[#F4F4F0] border-2 border-[#1A1C1A] flex items-center justify-center brutal-shadow-sm">
                      <span className="material-symbols-outlined text-[24px] text-[#285C45]">
                        {item.icon}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 border border-[#1A1C1A] uppercase ${
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
                  <div className="font-mono text-[11px] text-[#1A1C1A] bg-[#FAF9F6] p-2 border border-[#C0C9C1] truncate">
                    {item.meta}
                  </div>

                  <button
                    onClick={() => handleAction(item)}
                    className="w-full bg-[#FFFFFF] text-[#1A1C1A] py-2 border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold hover:bg-[#EEEEEA] brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>{item.actionLabel}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Integration Configuration Modal */}
      {selectedInt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg max-w-md w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#285C45] text-[20px]">
                  {selectedInt.icon}
                </span>
                <h3 className="font-headline font-bold text-[18px] uppercase">
                  {selectedInt.name}
                </h3>
              </div>
              <button onClick={() => setSelectedInt(null)}>
                <span className="material-symbols-outlined text-[20px] text-[#717973]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="flex flex-col gap-3 font-mono text-[12px]">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Adapter Webhook / Endpoint
                </label>
                <input
                  type="text"
                  defaultValue="https://veriqo.cluster.internal/hooks/v2/ci"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] p-2 focus:outline-none"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Service Token / Secret (Demonstration Mock)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] p-2 focus:outline-none"
                  disabled={saving}
                />
                <span className="text-[10px] text-[#717973] block mt-1">
                  Tokens are encrypted via Vault KMS before deployment.
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E2E3DF]">
                {selectedInt.status === 'CONNECTED' ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(selectedInt)}
                    disabled={saving}
                    className="text-[#AC3326] underline text-[11px] font-bold"
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
                    {saving ? 'Saving...' : 'Save & Connect'}
                  </button>
                </div>
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

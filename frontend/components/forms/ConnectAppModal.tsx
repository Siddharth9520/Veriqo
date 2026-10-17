'use client';

import React, { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Project, ProjectEnvironment } from '@/lib/types';
import { Icon } from '@/components/ui/Icons';

interface ConnectAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newProject: Project) => void;
}

export default function ConnectAppModal({ isOpen, onClose, onSuccess }: ConnectAppModalProps) {
  const [tab, setTab] = useState<'url' | 'github' | 'spec'>('url');
  const [url, setUrl] = useState('');
  const [githubRepo, setGithubRepo] = useState('acmeflow/web-checkout');
  const [specUrl, setSpecUrl] = useState('https://api.acmeflow.dev/openapi.json');
  const [appName, setAppName] = useState('');
  const [env, setEnv] = useState<ProjectEnvironment>('Staging');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    let domainToSubmit = '';

    if (tab === 'url') {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setError('Application URL is required.');
        return;
      }
      try {
        const parsed = trimmedUrl.includes('://') ? new URL(trimmedUrl) : new URL(`https://${trimmedUrl}`);
        domainToSubmit = parsed.hostname;
      } catch {
        setError('Invalid application domain format. Provide a valid URL (e.g., https://staging.myapp.dev).');
        return;
      }
    } else if (tab === 'github') {
      const cleanRepo = githubRepo.trim().replace(/^https?:\/\/github\.com\//, '');
      if (!cleanRepo) {
        setError('GitHub repository is required (e.g., owner/repo).');
        return;
      }
      domainToSubmit = `${cleanRepo.replace(/[^a-zA-Z0-9-]/g, '-')}.preview.dev`;
    } else {
      const cleanSpec = specUrl.trim();
      if (!cleanSpec) {
        setError('OpenAPI or HAR specification URL is required.');
        return;
      }
      try {
        const parsed = cleanSpec.includes('://') ? new URL(cleanSpec) : new URL(`https://${cleanSpec}`);
        domainToSubmit = parsed.hostname;
      } catch {
        domainToSubmit = 'api.acmeflow.dev';
      }
    }

    const nameToSubmit =
      appName.trim() ||
      (tab === 'github' ? githubRepo.trim() : tab === 'spec' ? `Spec: ${domainToSubmit}` : `Connected: ${domainToSubmit}`);

    setLoading(true);

    try {
      const created = await apiClient.connectProject({
        name: nameToSubmit,
        domain: domainToSubmit,
        environment: env,
        swarmMode: 'Deep Heuristic',
      });

      setSuccessMsg(`Target cluster connected! Project '${created.name}' initialized.`);
      if (onSuccess) {
        onSuccess(created);
      }

      setTimeout(() => {
        setSuccessMsg('');
        setUrl('');
        setAppName('');
        onClose();
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(`Failed to connect (${err.status}): ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unexpected error connecting application to cluster.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#285C45] text-white flex items-center justify-center border border-[#1A1C1A] rounded-lg">
              <Icon name="cable" className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-headline text-[20px] font-bold text-[#1A1C1A] leading-tight">
                Connect Web Application
              </h2>
              <span className="font-mono text-[10px] uppercase text-[#285C45] font-bold">
                [Live Cluster Gateway]
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#717973] hover:text-[#1A1C1A] p-1 border border-transparent hover:border-[#1A1C1A] rounded-md transition-colors"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-2 border-[#1A1C1A] bg-[#F4F4F0] p-1 font-mono text-[11px] font-bold uppercase rounded-lg gap-1">
          <button
            type="button"
            onClick={() => { setTab('url'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              tab === 'url' ? 'bg-[#285C45] text-white shadow-xs' : 'text-[#404943] hover:text-[#1A1C1A]'
            }`}
          >
            Direct Web URL
          </button>
          <button
            type="button"
            onClick={() => { setTab('github'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              tab === 'github' ? 'bg-[#285C45] text-white shadow-xs' : 'text-[#404943] hover:text-[#1A1C1A]'
            }`}
          >
            GitHub Repository
          </button>
          <button
            type="button"
            onClick={() => { setTab('spec'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              tab === 'spec' ? 'bg-[#285C45] text-white shadow-xs' : 'text-[#404943] hover:text-[#1A1C1A]'
            }`}
          >
            OpenAPI / HAR
          </button>
        </div>

        {/* Error / Success Feedback Banners */}
        {error && (
          <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-2.5 flex items-center gap-2 font-mono text-[12px] text-[#93000A] rounded-lg">
            <Icon name="warning" className="w-4 h-4 text-[#93000A]" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-[#B7EFD0] border-2 border-[#285C45] p-2.5 flex items-center gap-2 font-mono text-[12px] text-[#002114] rounded-lg">
            <Icon name="check" className="w-4 h-4 text-[#002114]" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {tab === 'url' && (
            <>
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Target Staging / Production URL *
                </label>
                <div className="flex items-center bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 brutal-shadow-sm focus-within:shadow-[3px_3px_0px_#285c45] rounded-lg">
                  <Icon name="link" className="w-4 h-4 text-[#717973] mr-2" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://staging.myapp.dev"
                    className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] placeholder:text-[#717973] focus:outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                  Friendly Project Label (Optional)
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="e.g. Acme Web Checkout"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[12px] text-[#1A1C1A] focus:outline-none brutal-shadow-sm rounded-lg"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {tab === 'github' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                  GitHub Repository (Auto-PR Mode)
                </label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="e.g. acmeflow/web-checkout"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[12px] text-[#1A1C1A] focus:outline-none brutal-shadow-sm rounded-lg"
                  disabled={loading}
                />
              </div>
              <div className="bg-[#EEEEEA] p-3 border border-[#C0C9C1] font-mono text-[11px] text-[#404943] rounded-lg">
                Autonomously discovers Playwright configs and GitHub Actions PR branches.
              </div>
            </div>
          )}

          {tab === 'spec' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                  OpenAPI Spec URL or HAR Endpoint
                </label>
                <input
                  type="text"
                  value={specUrl}
                  onChange={(e) => setSpecUrl(e.target.value)}
                  placeholder="https://api.acmeflow.dev/openapi.json"
                  className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[12px] text-[#1A1C1A] focus:outline-none brutal-shadow-sm rounded-lg"
                  disabled={loading}
                />
              </div>
              <div className="border-2 border-dashed border-[#1A1C1A] p-4 text-center bg-[#FAF9F6] cursor-pointer hover:bg-[#EEEEEA] rounded-xl transition-colors">
                <Icon name="upload" className="w-6 h-6 text-[#404943] mx-auto" />
                <p className="font-mono text-[11px] font-bold uppercase text-[#1A1C1A] mt-1">
                  Drop .har, .json, or .yaml file here
                </p>
              </div>
            </div>
          )}

          {/* Environment Selector */}
          <div>
            <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
              Environment Classification
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Staging', 'Prod Canary', 'Dev Sandbox'] as ProjectEnvironment[]).map((envOption) => (
                <button
                  key={envOption}
                  type="button"
                  onClick={() => setEnv(envOption)}
                  disabled={loading}
                  className={`py-1.5 px-2 border-2 font-mono text-[11px] font-bold uppercase rounded-lg transition-all ${
                    env === envOption
                      ? 'border-[#1A1C1A] bg-[#285C45] text-white brutal-shadow-sm'
                      : 'border-[#1A1C1A] bg-[#FAF9F6] text-[#404943] hover:bg-[#EEEEEA]'
                  }`}
                >
                  {envOption}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-[#1A1C1A]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border-2 border-[#1A1C1A] bg-[#FFFFFF] font-headline text-[12px] uppercase font-bold text-[#1A1C1A] hover:bg-[#EEEEEA] rounded-lg brutal-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 border-2 border-[#1A1C1A] bg-[#285C45] font-headline text-[12px] uppercase font-bold text-white hover:bg-[#0B442F] rounded-lg brutal-btn brutal-shadow flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                  <span>Verifying Cluster Link...</span>
                </>
              ) : (
                <>
                  <Icon name="check" className="w-4 h-4 text-white" />
                  <span>Confirm Link Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

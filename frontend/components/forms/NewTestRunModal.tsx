'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Project } from '@/lib/types';
import { initialProjects } from '@/lib/mock-data';
import { Icon } from '@/components/ui/Icons';

interface NewTestRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewTestRunModal({ isOpen, onClose }: NewTestRunModalProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProject, setSelectedProject] = useState(initialProjects[0]?.slug || 'commerce-platform');
  const [swarmMode, setSwarmMode] = useState('Deep Heuristic');
  const [environment, setEnvironment] = useState('Staging (us-east-01)');
  const [concurrency, setConcurrency] = useState('4');
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    apiClient.getProjects()
      .then((data) => {
        if (mounted && data.length > 0) {
          setProjects(data);
          setSelectedProject(data[0].slug);
        }
      })
      .catch(() => {
        // Fallback to initial
      });
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLaunching(true);
    setError('');

    try {
      await apiClient.startTestRun({
        projectSlug: selectedProject,
        swarmMode,
        environment,
      });

      setIsLaunching(false);
      onClose();
      // Navigate to command center to view live execution
      router.push('/command-center');
    } catch (err: unknown) {
      setIsLaunching(false);
      setError(err instanceof Error ? err.message : 'Failed to launch test run.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg w-full max-w-lg p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#285C45] text-white flex items-center justify-center border border-[#1A1C1A]">
              <Icon name="play" className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-headline text-[20px] font-bold text-[#1A1C1A] leading-tight">
                Launch Autonomous Test Run
              </h2>
              <span className="font-mono text-[10px] uppercase text-[#285C45] font-bold">
                [Veriqo Swarm Engine v2.4]
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#717973] hover:text-[#1A1C1A] p-1 border border-transparent hover:border-[#1A1C1A]"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-2.5 flex items-center gap-2 font-mono text-[12px] text-[#93000A]">
            <Icon name="warning" className="w-4 h-4 text-[#93000A]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLaunch} className="flex flex-col gap-3">
          {/* Project Selector */}
          <div>
            <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
              Target Application Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[12px] font-bold text-[#1A1C1A] focus:outline-none brutal-shadow-sm"
            >
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} ({p.domain})
                </option>
              ))}
            </select>
          </div>

          {/* Swarm Mode */}
          <div>
            <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
              Autonomous Swarm Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Deep Heuristic', label: 'Deep Heuristic', desc: 'DOM exploration + edge state fuzz' },
                { id: 'Chaos Edge', label: 'Chaos Edge', desc: 'Concurrency + packet drop stress' },
                { id: 'Fuzz & Payload', label: 'Fuzz & Payload', desc: 'Payload boundary & idempotency' },
                { id: 'ARIA & Visual', label: 'ARIA & Visual', desc: 'WCAG 2.1 AA + layout shifts' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSwarmMode(mode.id)}
                  className={`p-2 border-2 text-left flex flex-col gap-0.5 transition-all ${
                    swarmMode === mode.id
                      ? 'border-[#1A1C1A] bg-[#B7EFD0] text-[#002114] brutal-shadow-sm font-bold'
                      : 'border-[#1A1C1A] bg-[#FAF9F6] text-[#404943] hover:bg-[#EEEEEA]'
                  }`}
                >
                  <span className="font-headline text-[13px]">{mode.label}</span>
                  <span className="font-mono text-[10px] leading-tight text-[#404943]">{mode.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Environment & Concurrency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                Target Cluster
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[11px] font-bold text-[#1A1C1A] focus:outline-none brutal-shadow-sm"
              >
                <option value="Staging (us-east-01)">Staging (us-east-01)</option>
                <option value="Prod Canary (eu-west-01)">Prod Canary (eu-west-01)</option>
                <option value="Dev Sandbox">Dev Sandbox</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-bold uppercase text-[#404943] mb-1">
                Headless Swarm Nodes
              </label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] px-3 py-2 font-mono text-[11px] font-bold text-[#1A1C1A] focus:outline-none brutal-shadow-sm"
              >
                <option value="2">2 Headless Chromium Instances</option>
                <option value="4">4 Headless Chromium Instances</option>
                <option value="8">8 Swarm Cluster Instances</option>
              </select>
            </div>
          </div>

          {/* Telemetry info banner */}
          <div className="bg-[#FAF9F6] border border-[#717973] p-2.5 flex items-center gap-2 font-mono text-[11px]">
            <Icon name="analytics" className="w-4 h-4 text-[#285C45] flex-shrink-0" />
            <span className="text-[#404943]">
              Allocates isolated container sandbox with HAR trace recording and DevTools CDP hooks.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E3DF] mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLaunching}
              className="px-4 py-2 bg-[#FAF9F6] border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold brutal-shadow-sm hover:bg-[#E8E8E5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLaunching}
              className="px-4 py-2 bg-[#285C45] text-white border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold brutal-shadow-sm hover:bg-[#0B442F] flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              {isLaunching ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Provisioning Cluster...</span>
                </>
              ) : (
                <>
                  <Icon name="play" className="w-4 h-4 text-white" />
                  <span>Dispatch Swarm Run</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

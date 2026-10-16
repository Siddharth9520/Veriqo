'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { title: 'Command Center', subtitle: 'Live Chromium runner & Swarm telemetry', href: '/command-center', icon: 'terminal', type: 'Route' },
    { title: 'Projects Overview', subtitle: '6 connected applications in fleet', href: '/projects', icon: 'folder_code', type: 'Route' },
    { title: 'VRQ-9482 // Heuristic Exploration', subtitle: 'Active execution on Storefront Web', href: '/command-center', icon: 'play_circle', type: 'Active Run' },
    { title: 'VRQ-9482-D01: Idempotency failure on double payment', subtitle: 'Coral P0 Defect - 100% Repro Confidence', href: '/bug-reports', icon: 'bug_report', type: 'Defect' },
    { title: 'Commerce Platform (Storefront Web)', subtitle: 'shop.acmeflow.dev · Staging', href: '/projects', icon: 'shopping_cart', type: 'Project' },
    { title: 'Merchant Dashboard & Billing', subtitle: 'dashboard.acmeflow.internal · Canary', href: '/projects', icon: 'payments', type: 'Project' },
    { title: 'Test Library Suites', subtitle: '148 regression suites and fuzz models', href: '/test-library', icon: 'dataset', type: 'Route' },
    { title: 'Analytics & Pass Rate Heatmap', subtitle: 'Fleet quality index and execution trends', href: '/analytics', icon: 'analytics', type: 'Route' },
    { title: 'Integrations & Artifact Ingestion', subtitle: 'GitHub App, OpenAPI 3.1, HAR Traces', href: '/integrations', icon: 'hub', type: 'Route' },
    { title: 'Cluster & Agent Settings', subtitle: 'Headless Chromium flags, timeouts, tokens', href: '/settings', icon: 'settings', type: 'Route' },
  ];

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      item.type.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#191B19]/70 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="p-3 border-b-2 border-[#1A1C1A] bg-[#FAF9F6] flex items-center gap-2">
          <Icon name="search" className="w-5 h-5 text-[#717973] flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, route, defect ID or project..."
            className="w-full bg-transparent font-mono text-[13px] text-[#1A1C1A] placeholder:text-[#717973] focus:outline-none"
          />
          <span className="font-mono text-[10px] bg-[#E2E3DF] border border-[#1A1C1A] px-1.5 py-0.5 text-[#1A1C1A] rounded-md font-bold">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E3DF] p-1.5 bg-[#FFFFFF] flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <div className="p-6 text-center font-mono text-[12px] text-[#717973]">
              No matching commands or resources found for &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(item.href)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[#FAF9F6] transition-colors group rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#F4F4F0] border border-[#1A1C1A] flex items-center justify-center group-hover:bg-[#B7EFD0] transition-colors flex-shrink-0 rounded-lg">
                    <Icon name={item.icon} className="w-4 h-4 text-[#1A1C1A]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline font-bold text-[13px] text-[#1A1C1A]">
                      {item.title}
                    </span>
                    <span className="font-mono text-[11px] text-[#717973]">
                      {item.subtitle}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 bg-[#EEEEEA] border border-[#1A1C1A] text-[#404943] rounded-md">
                  {item.type}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t-2 border-[#1A1C1A] bg-[#F4F4F0] flex items-center justify-between font-mono text-[10px] text-[#717973]">
          <span>Navigation Quick Command Bar</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
}

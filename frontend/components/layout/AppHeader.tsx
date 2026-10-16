'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import ConnectAppModal from '@/components/forms/ConnectAppModal';
import NewTestRunModal from '@/components/forms/NewTestRunModal';
import GlobalSearchModal from '@/components/forms/GlobalSearchModal';
import AppSidebar from './AppSidebar';
import { apiClient } from '@/lib/api-client';
import { ClusterHealth } from '@/lib/types';
import { Icon } from '@/components/ui/Icons';

export default function AppHeader() {
  const pathname = usePathname();
  const [connectOpen, setConnectOpen] = useState(false);
  const [testRunOpen, setTestRunOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clusterHealth, setClusterHealth] = useState<ClusterHealth | null>(null);
  const [isLive, setIsLive] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const health = await apiClient.getClusterHealth();
        if (mounted) {
          setClusterHealth(health);
          setIsLive(true);
        }
      } catch {
        if (mounted) {
          setIsLive(false);
        }
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute breadcrumb title from pathname
  const getRouteTitle = () => {
    if (pathname === '/command-center') return 'Command Center';
    if (pathname === '/projects' || pathname === '/') return 'Projects';
    if (pathname === '/test-runs') return 'Test Runs';
    if (pathname === '/bug-reports') return 'Bug Reports';
    if (pathname === '/test-library') return 'Test Library';
    if (pathname === '/analytics') return 'Analytics';
    if (pathname === '/integrations') return 'Integrations';
    if (pathname === '/settings') return 'Settings';
    return pathname.replace('/', '').replace('-', ' ').toUpperCase();
  };

  return (
    <>
      <header className="fixed top-0 md:left-72 left-0 right-0 h-16 bg-[#FFFFFF] border-b-2 border-[#1A1C1A] z-40 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Mobile Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden flex items-center justify-center p-1.5 border-2 border-[#1A1C1A] bg-[#FAF9F6] text-[#1A1C1A] rounded-lg brutal-shadow-xs hover:bg-[#E8E8E5]"
            aria-label="Open Navigation Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2 font-mono text-[13px] uppercase">
            <span className="text-[#404943]">Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-bold">{getRouteTitle()}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-[#EEEEEA] border border-[#1A1C1A] rounded-md px-2.5 py-0.5 shadow-[1.5px_1.5px_0px_#1a1c1a]">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                isLive ? 'bg-[#285C45] animate-pulse' : 'bg-[#FD6E5B]'
              }`}
            ></span>
            <span className="font-mono text-[10px] font-semibold uppercase text-[#1A1C1A]">
              {isLive && clusterHealth
                ? `LIVE BACKEND: 200 OK (${clusterHealth.latencyMs}ms)`
                : isLive
                ? 'CLUSTER US-EAST: OPERATIONAL'
                : 'CLUSTER OFFLINE: DEMO MODE'}
            </span>
          </div>
        </div>

        {/* Right: Quick Search & Primary CTAs */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 bg-[#F4F4F0] border-2 border-[#1A1C1A] rounded-lg px-3 py-1.5 shadow-[2px_2px_0px_#1a1c1a] hover:bg-[#EEEEEA] transition-transform"
          >
            <Icon name="search" className="w-4 h-4 text-[#404943]" />
            <span className="font-mono text-[12px] text-[#717973] text-left w-36 truncate">
              Quick search command...
            </span>
            <span className="font-mono text-[10px] bg-[#E2E3DF] border border-[#1A1C1A] rounded px-1 text-[#1A1C1A]">
              ⌘K
            </span>
          </button>

          {/* Connect App Action */}
          <button
            onClick={() => setConnectOpen(true)}
            className="hidden sm:flex items-center gap-1.5 bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-lg px-3 py-1.5 font-headline text-[13px] uppercase text-[#1A1C1A] font-bold hover:bg-[#E8E8E5] brutal-btn shadow-[2.5px_2.5px_0px_#1a1c1a]"
          >
            <Icon name="cable" className="w-4 h-4 text-[#1A1C1A]" />
            <span>Connect App</span>
          </button>

          {/* New Test Run Action */}
          <button
            onClick={() => setTestRunOpen(true)}
            className="flex items-center gap-1.5 bg-[#285C45] text-white border-2 border-[#1A1C1A] rounded-lg px-3 py-1.5 font-headline text-[13px] uppercase font-bold hover:bg-[#0B442F] brutal-btn shadow-[2.5px_2.5px_0px_#1a1c1a]"
          >
            <Icon name="plus" className="w-4 h-4 text-white" />
            <span className="hidden xs:inline">+ New Test Run</span>
            <span className="xs:hidden">+ Run</span>
          </button>

          {/* User Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-[#0B442F] flex items-center justify-center border border-[#1A1C1A] text-white cursor-pointer"
            title="E. Turing (Lead QA Architect)"
          >
            <Icon name="person" className="w-4 h-4 text-white" />
          </div>
        </div>
      </header>

      {/* Mobile Drawer (rendered conditionally via state) */}
      <AppSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Interactive Global Modals */}
      <ConnectAppModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} />
      <NewTestRunModal isOpen={testRunOpen} onClose={() => setTestRunOpen(false)} />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

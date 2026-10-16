'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectAppModal from '@/components/forms/ConnectAppModal';
import NewTestRunModal from '@/components/forms/NewTestRunModal';
import GlobalSearchModal from '@/components/forms/GlobalSearchModal';
import AppSidebar from './AppSidebar';
import { apiClient } from '@/lib/api-client';
import { ClusterHealth } from '@/lib/types';
import { Icon } from '@/components/ui/Icons';

interface OperatorProfile {
  name: string;
  role: string;
  email: string;
  status: string;
  avatarInitials: string;
}

const DEFAULT_OPERATOR: OperatorProfile = {
  name: 'E. Turing',
  role: 'Lead QA Architect',
  email: 'e.turing@acmeflow.dev',
  status: 'Authenticated',
  avatarInitials: 'ET',
};

export default function AppHeader() {
  const pathname = usePathname();
  const [connectOpen, setConnectOpen] = useState(false);
  const [testRunOpen, setTestRunOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [clusterHealth, setClusterHealth] = useState<ClusterHealth | null>(null);
  const [isLive, setIsLive] = useState<boolean>(true);

  const profileContainerRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setProfileOpen(false);
  }

  // Handle outside click & Escape key to close profile dropdown
  useEffect(() => {
    if (!profileOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        profileContainerRef.current &&
        !profileContainerRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

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

  const operator = DEFAULT_OPERATOR;

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

        {/* Right: Quick Search, CTAs & User Profile */}
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

          {/* Interactive User Profile Dropdown Anchor */}
          <div className="relative" ref={profileContainerRef}>
            <button
              ref={profileButtonRef}
              type="button"
              id="operator-profile-button"
              onClick={() => setProfileOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && !profileOpen) {
                  e.preventDefault();
                  setProfileOpen(true);
                }
              }}
              aria-label="Operator account and profile menu for E. Turing"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-controls="operator-profile-dropdown"
              title="E. Turing (Lead QA Architect) — Account & Preferences"
              className={`w-8 h-8 rounded-full bg-[#0B442F] flex items-center justify-center border-2 border-[#1A1C1A] text-white cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1C1A] focus-visible:ring-offset-2 ${
                profileOpen
                  ? 'scale-105 ring-2 ring-[#1A1C1A] ring-offset-2 shadow-[2px_2px_0px_#1a1c1a]'
                  : 'hover:scale-105 shadow-[1.5px_1.5px_0px_#1a1c1a]'
              }`}
            >
              <Icon name="person" className="w-4 h-4 text-white" />
              <span className="sr-only">Toggle Operator Profile Menu</span>
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div
                id="operator-profile-dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="operator-profile-button"
                className="absolute right-0 top-full mt-2 w-[288px] sm:w-80 max-w-[calc(100vw-24px)] bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-xl shadow-[3.5px_3.5px_0px_#1a1c1a] z-50 overflow-hidden"
              >
                {/* Header: Operator Identity */}
                <div className="p-3.5 bg-[#FAF9F6] border-b-2 border-[#1A1C1A]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0B442F] border-2 border-[#1A1C1A] flex items-center justify-center text-white font-mono font-bold text-[13px] flex-shrink-0 shadow-[1.5px_1.5px_0px_#1a1c1a]">
                      {operator.avatarInitials || 'ET'}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-headline font-bold text-[14px] text-[#1A1C1A] truncate">
                          {operator.name || 'Operator'}
                        </span>
                        <span className="bg-[#B7EFD0] text-[#002114] border border-[#1A1C1A] font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0">
                          {operator.status || 'Active'}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#404943] truncate">
                        {operator.role || 'QA Architect'}
                      </span>
                      <span className="font-mono text-[10px] text-[#717973] truncate">
                        {operator.email || 'e.turing@acmeflow.dev'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Strip: Active Cluster */}
                <div className="px-3.5 py-2 bg-[#EEEEEA] border-b-2 border-[#1A1C1A] flex items-center justify-between font-mono text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        isLive ? 'bg-[#285C45] animate-pulse' : 'bg-[#FD6E5B]'
                      }`}
                    />
                    <span className="font-bold text-[#1A1C1A] uppercase">
                      {isLive && clusterHealth ? 'ACME-STAGING-01' : 'DEMO CLUSTER'}
                    </span>
                  </div>
                  <span className="text-[#404943]">
                    {isLive ? '200 OK • Operational' : 'Offline / Standby'}
                  </span>
                </div>

                {/* Menu Navigation Items */}
                <div className="p-1.5 flex flex-col gap-1">
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#1A1C1A] hover:bg-[#FAF9F6] border border-transparent hover:border-[#1A1C1A] transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-[#FAF9F6] border border-[#1A1C1A] text-[#285C45] group-hover:bg-[#285C45] group-hover:text-white transition-colors">
                      <Icon name="person" className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-headline font-bold text-[12px] uppercase tracking-wide">
                        Operator Profile &amp; Preferences
                      </span>
                      <span className="font-mono text-[10px] text-[#717973]">
                        Browser engines, alerts &amp; credentials
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/command-center"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#1A1C1A] hover:bg-[#FAF9F6] border border-transparent hover:border-[#1A1C1A] transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-[#FAF9F6] border border-[#1A1C1A] text-[#285C45] group-hover:bg-[#285C45] group-hover:text-white transition-colors">
                      <Icon name="terminal" className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-headline font-bold text-[12px] uppercase tracking-wide">
                        System Command Center
                      </span>
                      <span className="font-mono text-[10px] text-[#717973]">
                        Live swarm terminal &amp; node monitors
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#1A1C1A] hover:bg-[#FAF9F6] border border-transparent hover:border-[#1A1C1A] transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-[#FAF9F6] border border-[#1A1C1A] text-[#285C45] group-hover:bg-[#285C45] group-hover:text-white transition-colors">
                      <Icon name="help" className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-headline font-bold text-[12px] uppercase tracking-wide">
                        Docs &amp; Architecture Manual
                      </span>
                      <span className="font-mono text-[10px] text-[#717973]">
                        Runbooks, CDP spec &amp; telemetry guides
                      </span>
                    </div>
                  </Link>

                  <div className="my-1 border-t border-[#EEEEEA]" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      setSearchOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[#1A1C1A] hover:bg-[#FAF9F6] border border-transparent hover:border-[#1A1C1A] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-[#FAF9F6] border border-[#1A1C1A] text-[#404943] group-hover:bg-[#1A1C1A] group-hover:text-white transition-colors">
                        <Icon name="search" className="w-4 h-4" />
                      </div>
                      <span className="font-headline font-bold text-[12px] uppercase tracking-wide">
                        Quick Command Search
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-[#E2E3DF] border border-[#1A1C1A] rounded px-1.5 py-0.5 text-[#1A1C1A]">
                      ⌘K
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      setConnectOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#1A1C1A] hover:bg-[#FAF9F6] border border-transparent hover:border-[#1A1C1A] transition-colors text-left group"
                  >
                    <div className="p-1.5 rounded-md bg-[#FAF9F6] border border-[#1A1C1A] text-[#404943] group-hover:bg-[#1A1C1A] group-hover:text-white transition-colors">
                      <Icon name="cable" className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-headline font-bold text-[12px] uppercase tracking-wide">
                        Connect Target App
                      </span>
                      <span className="font-mono text-[10px] text-[#717973]">
                        Add new web domain or test environment
                      </span>
                    </div>
                  </button>
                </div>

                {/* Footer: Cluster Info */}
                <div className="px-3.5 py-2 bg-[#FAF9F6] border-t-2 border-[#1A1C1A] flex items-center justify-between font-mono text-[10px] text-[#717973]">
                  <span>Veriqo Core v2.4.1</span>
                  <span className="flex items-center gap-1 text-[#285C45] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#285C45] inline-block" />
                    Cluster Root
                  </span>
                </div>
              </div>
            )}
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

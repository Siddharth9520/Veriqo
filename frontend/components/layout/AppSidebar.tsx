'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigationItems } from '@/lib/navigation';
import { Icon } from '@/components/ui/Icons';

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname();
  const [cluster, setCluster] = useState('Acme Staging / Prod');
  const [showClusterDropdown, setShowClusterDropdown] = useState(false);

  const clusters = [
    'Acme Staging / Prod',
    'Acme Staging US-East',
    'Acme Canary EU-West',
    'Local Dev Cluster (Port 3000)',
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full text-[#F1F1ED] select-none">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 px-4 border-b-2 border-[#1A1C1A] flex items-center justify-between bg-[#191B19]">
          <Link href="/command-center" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#285C45] border-2 border-[#1A1C1A] flex items-center justify-center relative brutal-shadow-sm">
              <Icon name="radar" className="w-5 h-5 text-[#9CD2B5]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#9CD2B5] border border-[#1A1C1A] rounded-full"></span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-[17px] uppercase tracking-wider text-[#F1F1ED] font-bold leading-none">
                Veriqo
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#C0C9C1] mt-0.5">
                Autonomous QA
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#B7EFD0] border border-[#1A1C1A] rounded-full animate-pulse" title="System Operational"></div>
            {onMobileClose && (
              <button 
                onClick={onMobileClose}
                className="md:hidden text-[#C0C9C1] hover:text-[#FFFFFF] p-1"
                aria-label="Close Sidebar"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Target Cluster Switcher */}
        <div className="p-2 border-b-2 border-[#1A1C1A] bg-[#191B19] relative">
          <button
            onClick={() => setShowClusterDropdown(!showClusterDropdown)}
            className="w-full bg-[#1A1C1A] border border-[#717973] flex items-center justify-between px-3 py-1.5 brutal-shadow-black hover:border-[#9CD2B5] transition-colors text-left"
          >
            <div className="flex flex-col overflow-hidden">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#C0C9C1]">Target Cluster</span>
              <span className="font-mono text-[12px] truncate text-[#F1F1ED] font-semibold">{cluster}</span>
            </div>
            <Icon name="unfold_more" className="w-4 h-4 text-[#C0C9C1] flex-shrink-0" />
          </button>

          {showClusterDropdown && (
            <div className="absolute left-2 right-2 top-full mt-1 bg-[#191B19] border-2 border-[#1A1C1A] brutal-shadow z-50 flex flex-col p-1">
              {clusters.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCluster(c);
                    setShowClusterDropdown(false);
                  }}
                  className={`text-left px-2.5 py-1.5 font-mono text-[12px] uppercase transition-colors ${
                    cluster === c ? 'bg-[#285C45] text-white font-bold' : 'text-[#F1F1ED] hover:bg-[#1A1C1A]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 p-2">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === '/projects' && pathname === '/') ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center justify-between px-3 py-1.5 font-mono text-[12px] tracking-wide uppercase transition-all ${
                  isActive
                    ? 'bg-[#285C45] text-[#FFFFFF] border-2 border-[#1A1C1A] shadow-[3px_3px_0px_#1a1c1a] font-semibold'
                    : 'text-[#F1F1ED] hover:bg-[#1A1C1A] hover:text-[#FAF9F6] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon name={item.icon} className="w-4 h-4 flex-shrink-0" />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="bg-[#FD6E5B] text-white text-[10px] font-bold px-1.5 py-0.5 border border-[#1A1C1A]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="flex flex-col border-t-2 border-[#1A1C1A] p-2 gap-2 bg-[#191B19]">
        {/* Live Agent Engine Status */}
        <div className="bg-[#1A1C1A] border border-[#717973] p-2.5 flex flex-col gap-1 brutal-shadow-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#B7EFD0] inline-block animate-ping"></span>
              <span className="font-mono text-[10px] font-bold uppercase text-[#B7EFD0]">Live Agent Engine</span>
            </div>
            <span className="font-mono text-[10px] text-[#C0C9C1]">99.8%</span>
          </div>
          <span className="font-mono text-[11px] text-[#F1F1ED]">Veriqo Core v2.4 Active</span>
          <div className="w-full bg-[#191B19] h-1.5 border border-[#717973] overflow-hidden">
            <div className="bg-[#285C45] h-full w-[84%]"></div>
          </div>
        </div>

        {/* Documentation & Manual Link */}
        <div className="flex items-center justify-between px-1">
          <Link
            href="/settings"
            className="font-mono text-[11px] text-[#C0C9C1] hover:text-[#F1F1ED] uppercase tracking-wider flex items-center gap-1.5"
          >
            <Icon name="help" className="w-3.5 h-3.5 text-[#C0C9C1]" />
            <span>Docs &amp; Manual</span>
          </Link>
          <span className="font-mono text-[10px] text-[#C0C9C1]">v2.4.1</span>
        </div>

        {/* User Profile */}
        <div className="flex items-center justify-between pt-1.5 border-t border-[#717973]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0B442F] flex items-center justify-center border border-[#1A1C1A] flex-shrink-0">
              <Icon name="person" className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[12px] text-[#F1F1ED] font-semibold leading-tight">E. Turing</span>
              <span className="font-mono text-[10px] text-[#C0C9C1]">Lead QA Architect</span>
            </div>
          </div>
          <Icon name="more_vert" className="w-4 h-4 text-[#C0C9C1] flex-shrink-0 cursor-pointer" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-72 bg-[#191B19] border-r-2 border-[#1A1C1A] z-50 flex-col justify-between">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-[#191B19]/70 backdrop-blur-sm"
            onClick={onMobileClose}
          ></div>
          <div className="relative w-72 h-full bg-[#191B19] border-r-2 border-[#1A1C1A] z-10 flex flex-col justify-between">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

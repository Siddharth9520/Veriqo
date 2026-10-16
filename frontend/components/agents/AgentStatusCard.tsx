'use client';

import React from 'react';
import { swarmAgents } from '@/lib/mock-data';
import { Icon } from '@/components/ui/Icons';

export default function AgentStatusCard() {
  return (
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-xl brutal-shadow p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#C0C9C1]">
        <div className="flex items-center gap-2">
          <Icon name="hub" className="w-5 h-5 text-[#285C45]" />
          <span className="font-headline text-[16px] uppercase tracking-wide font-bold">
            Swarm Agent Orchestrator
          </span>
        </div>
        <span className="font-mono text-[11px] bg-[#E2E3DF] border border-[#1A1C1A] rounded-md px-2 py-0.5 text-[#1A1C1A] font-bold">
          3 AGENTS
        </span>
      </div>

      {/* Agents List */}
      <div className="flex flex-col gap-2">
        {swarmAgents.map((agent) => {
          const isActive = agent.status === 'ACTIVE';
          const isExecuting = agent.status === 'EXECUTING';

          return (
            <div
              key={agent.id}
              className="bg-[#F4F4F0] border-2 border-[#1A1C1A] rounded-lg p-2.5 flex items-center justify-between brutal-shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#E2E3DF] border border-[#1A1C1A] rounded-md flex items-center justify-center flex-shrink-0">
                  <Icon
                    name={agent.icon}
                    className={`w-4 h-4 ${
                      isExecuting ? 'text-[#AC3326]' : isActive ? 'text-[#285C45]' : 'text-[#717973]'
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-[14px] font-bold uppercase text-[#1A1C1A]">
                    {agent.title}
                  </span>
                  <span className="font-mono text-[11px] text-[#404943] leading-tight">
                    {agent.description}
                  </span>
                </div>
              </div>

              {isActive && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-[#0B442F] font-bold bg-[#B7EFD0] border border-[#1A1C1A] rounded-md px-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#0B442F] inline-block animate-pulse"></span>
                  ACTIVE
                </div>
              )}

              {isExecuting && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-[#FD6E5B] font-bold bg-[#FFDAD6] border border-[#1A1C1A] rounded-md px-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#AC3326] inline-block animate-ping"></span>
                  EXECUTING
                </div>
              )}

              {!isActive && !isExecuting && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-[#404943] bg-[#E2E3DF] border border-[#717973] rounded-md px-2 py-0.5 font-semibold">
                  STANDBY
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

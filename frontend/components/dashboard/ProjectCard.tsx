'use client';

import React from 'react';
import Link from 'next/link';
import { Project } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icons';

interface ProjectCardProps {
  project: Project;
  viewMode?: 'grid' | 'list';
  onStartRun?: (project: Project) => void;
  onOpenDetails?: (project: Project) => void;
}

export default function ProjectCard({
  project,
  viewMode = 'grid',
  onStartRun,
  onOpenDetails,
}: ProjectCardProps) {
  const isCritical = project.health === 'critical_regression';
  const isScanning = project.health === 'scanning';

  return (
    <div
      className={`bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-xl brutal-shadow overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5 ${
        viewMode === 'list' ? 'w-full' : ''
      }`}
    >
      {/* Header Strip */}
      <div className="p-4 border-b-2 border-[#1A1C1A] flex flex-col gap-1 bg-[#FAF9F6]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 ${
                isCritical
                  ? 'bg-[#FFDAD5]'
                  : isScanning
                  ? 'bg-[#FFDF9B]'
                  : 'bg-[#B7EFD0]'
              } border-2 border-[#1A1C1A] rounded-lg flex items-center justify-center brutal-shadow-xs flex-shrink-0`}
            >
              <Icon
                name={project.icon || 'folder'}
                className={`w-5 h-5 ${
                  isCritical
                    ? 'text-[#AC3326]'
                    : isScanning
                    ? 'text-[#4C3800]'
                    : 'text-[#0B442F]'
                }`}
              />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-headline text-[18px] sm:text-[20px] text-[#1A1C1A] font-bold tracking-tight truncate">
                {project.name}
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#404943] flex-wrap mt-0.5">
                <span className="flex items-center gap-1">
                  <Icon name="link" className="w-3.5 h-3.5 text-[#404943] flex-shrink-0" />
                  <span className="underline">{project.domain}</span>
                </span>
                <span className="px-1.5 py-0.5 bg-[#E2E3DF] border border-[#1A1C1A] rounded-md text-[#1A1C1A] uppercase font-bold text-[10px]">
                  {project.environment}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge status={project.health} label={project.healthLabel} />
        </div>

        <div className="flex items-center gap-3 text-[#404943] font-mono text-[11px] mt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Icon
              name={isScanning ? 'sync' : 'schedule'}
              className={`w-3.5 h-3.5 ${isScanning ? 'text-[#694E00] animate-spin' : 'text-[#717973]'}`}
            />
            <span className={isScanning ? 'text-[#694E00] font-bold' : ''}>
              {isScanning ? 'Running now' : `Last Exec: ${project.lastExecution}`}
            </span>
          </div>
          <span className="text-[#717973]">·</span>
          <div className="flex items-center gap-1.5">
            {!isScanning && <Icon name="timer" className="w-3.5 h-3.5 text-[#717973]" />}
            <span>{isScanning ? project.duration : `Duration: ${project.duration}`}</span>
          </div>
        </div>
      </div>

      {/* Body: Telemetry Strip & Matrix */}
      <div className="p-4 flex flex-col gap-4">
        {/* Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 border-2 border-[#1A1C1A] rounded-lg p-2 bg-[#F4F4F0]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase text-[#717973]">Pass Rate</span>
            <span
              className={`font-mono text-[14px] font-bold ${
                isCritical
                  ? 'text-[#AC3326]'
                  : isScanning
                  ? 'text-[#1A1C1A]'
                  : 'text-[#0B442F]'
              }`}
            >
              {project.passRate.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase text-[#717973]">Open Defects</span>
            <span
              className={`font-mono text-[14px] font-bold ${
                project.openDefects > 0 ? 'text-[#AC3326]' : 'text-[#1A1C1A]'
              }`}
            >
              {project.openDefectsLabel}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase text-[#717973]">Test Cases</span>
            <span className="font-mono text-[14px] font-bold text-[#1A1C1A]">
              {project.testCount} {isScanning ? 'Cases' : 'Suites'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase text-[#717973]">Swarm Mode</span>
            <span
              className="font-mono text-[11px] font-bold text-[#0B442F] uppercase truncate"
              title={project.swarmMode}
            >
              {project.swarmMode}
            </span>
          </div>
        </div>

        {/* Live scanning progress bar OR Subsystem Coverage Matrix */}
        {isScanning && project.liveProgress ? (
          <div className="flex flex-col gap-1.5 bg-[#EEEEEA] p-3 border-2 border-[#1A1C1A] rounded-lg">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase font-bold">
              <span className="flex items-center gap-1.5 text-[#1A1C1A]">
                <Icon name="sync" className="w-4 h-4 text-[#694E00] animate-spin" />
                Live Autonomous Execution Progress
              </span>
              <span className="font-mono text-[#694E00] font-bold">
                {project.liveProgress.percentage}% Completed
              </span>
            </div>

            <div className="w-full h-3 bg-white border border-[#1A1C1A] rounded-full overflow-hidden p-0.5">
              <div
                className="bg-[#694E00] h-full rounded-full transition-all duration-300"
                style={{ width: `${project.liveProgress.percentage}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-[#404943] mt-0.5 flex-wrap">
              <span className="truncate max-w-[260px]">{project.liveProgress.step}</span>
              <span>ETA: {project.liveProgress.eta}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider font-bold">
              <span className="text-[#1A1C1A]">Subsystem Coverage Matrix</span>
              <span className="font-mono text-[#717973]">Autonomous Depth L3</span>
            </div>

            <div className="flex flex-col gap-2 font-mono text-[11px]">
              {project.coverageMatrix.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-0.5">
                    <span className={item.flagged ? 'text-[#AC3326] font-semibold' : 'text-[#1A1C1A]'}>
                      {item.name}
                    </span>
                    <span
                      className={`font-bold ${
                        item.flagged
                          ? 'text-[#AC3326]'
                          : item.percentage === 100
                          ? 'text-[#0B442F]'
                          : 'text-[#404943]'
                      }`}
                    >
                      {item.percentage}% {item.statusNote ? `(${item.statusNote})` : ''}
                    </span>
                  </div>
                  <ProgressBar percentage={item.percentage} flagged={item.flagged} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="p-4 border-t-2 border-[#1A1C1A] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-2">
        {isScanning ? (
          <>
            <Link
              href="/command-center"
              className="bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] rounded-lg px-4 py-1.5 font-headline text-[13px] uppercase shadow-[2px_2px_0px_#1a1c1a] hover:bg-[#1A1C1A] brutal-btn flex items-center gap-1.5"
            >
              <Icon name="terminal" className="w-4 h-4 text-[#9CD2B5]" />
              <span>View Live Stream</span>
            </Link>

            <button
              onClick={() => alert('Run paused for debugging snapshot.')}
              className="bg-[#FFDAD5] text-[#410000] border-2 border-[#1A1C1A] rounded-lg px-4 py-1.5 font-headline text-[13px] uppercase font-bold shadow-[2px_2px_0px_#1a1c1a] hover:bg-[#AC3326] hover:text-white brutal-btn flex items-center gap-1.5"
            >
              <Icon name="stop_circle" className="w-4 h-4" />
              <span>Stop Run</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => (onOpenDetails ? onOpenDetails(project) : alert(`Inspecting ${project.name}`))}
              className="bg-[#FFFFFF] text-[#1A1C1A] border-2 border-[#1A1C1A] rounded-lg px-4 py-1.5 font-headline text-[13px] uppercase font-bold shadow-[2px_2px_0px_#1a1c1a] hover:bg-[#E8E8E5] brutal-btn flex items-center gap-1.5"
            >
              <Icon name="folder_open" className="w-4 h-4 text-[#1A1C1A]" />
              <span>Open Project</span>
            </button>

            {onStartRun ? (
              <button
                onClick={() => onStartRun(project)}
                className="bg-[#285C45] text-white border-2 border-[#1A1C1A] rounded-lg px-4 py-1.5 font-headline text-[13px] uppercase font-bold shadow-[2px_2px_0px_#1a1c1a] hover:bg-[#0B442F] brutal-btn flex items-center gap-1.5"
              >
                <Icon name="play" className="w-4 h-4" />
                <span>+ Start Autonomous Run</span>
              </button>
            ) : (
              <Link
                href="/command-center"
                className="bg-[#285C45] text-white border-2 border-[#1A1C1A] rounded-lg px-4 py-1.5 font-headline text-[13px] uppercase font-bold shadow-[2px_2px_0px_#1a1c1a] hover:bg-[#0B442F] brutal-btn flex items-center gap-1.5"
              >
                <Icon name="play" className="w-4 h-4" />
                <span>+ Start Autonomous Run</span>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

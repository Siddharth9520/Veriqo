'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TerminalLog } from '@/lib/types';
import { initialLogs } from '@/lib/mock-data';
import { apiClient } from '@/lib/api-client';
import { Icon } from '@/components/ui/Icons';

export default function TerminalPanel() {
  const [logs, setLogs] = useState<TerminalLog[]>(initialLogs);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    let isMounted = true;
    apiClient.getLogs()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setLogs(data);
        }
      })
      .catch(() => {
        // Retain existing logs
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSendCommand = async () => {
    const cmd = inputVal.trim();
    if (!cmd || isSending) return;
    setInputVal('');
    setIsSending(true);

    try {
      const res = await apiClient.sendTerminalCommand(cmd);
      if (res.logs && res.logs.length > 0) {
        setLogs((prev) => [...prev, ...res.logs]);
      }
    } catch {
      const now = new Date();
      const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(
        now.getUTCMinutes()
      ).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
      setLogs((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          timestamp: timeStr,
          agent: 'OPERATOR',
          message: `$ ${cmd}`,
        },
        {
          id: `err-${Date.now()}`,
          timestamp: timeStr,
          agent: 'ORCHESTRATOR',
          message: `Cluster command buffer processed: "${cmd}" in offline mode.`,
          type: 'warning',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setLogs([
      {
        id: 'log-clear',
        timestamp: 'CONSOLE READY',
        agent: 'SYSTEM',
        message: 'Live tail active...',
      },
    ]);
  };

  return (
    <div className="bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] brutal-shadow-lg p-4 flex flex-col gap-2 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#717973]">
        <div className="flex items-center gap-2 text-[#B7EFD0]">
          <Icon name="terminal" className="w-5 h-5" />
          <span className="font-mono text-[12px] uppercase font-bold tracking-wider">
            Autonomous Agent Stream
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#C0C9C1] font-bold bg-[#1A1C1A] px-1.5 py-0.5">
            TAIL -F [LIVE IPC]
          </span>
          <button
            onClick={handleClear}
            className="text-[#C0C9C1] hover:text-white p-1"
            title="Clear Output"
          >
            <Icon name="delete_sweep" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content Box */}
      <div
        ref={logContainerRef}
        className="bg-[#1A1C1A] border border-[#717973] p-3 h-64 overflow-y-auto flex flex-col gap-2 font-mono text-[12px] leading-relaxed text-[#F1F1ED] select-text shadow-inner terminal-scroll"
      >
        {logs.map((log) => {
          let agentColor = 'text-[#B7EFD0]';
          if (log.agent === 'TESTER') agentColor = 'text-[#FFDAD5]';
          if (log.agent === 'REPORTER') agentColor = 'text-[#FFDF9B]';
          if (log.agent === 'DISCOVERY') agentColor = 'text-[#FD6E5B]';
          if (log.agent === 'OPERATOR') agentColor = 'text-[#FFFFFF] underline';
          if (log.agent === 'SWARM_WORKER_02') agentColor = 'text-[#80D5AC]';

          const isDiscovery = log.agent === 'DISCOVERY';

          return (
            <div
              key={log.id}
              className={`flex items-start gap-2 ${
                isDiscovery ? 'bg-[#FD6E5B]/20 border-l-2 border-[#FD6E5B] p-1' : ''
              }`}
            >
              <span className="text-[#C0C9C1] shrink-0">[{log.timestamp}]</span>
              <span className={`${agentColor} shrink-0 font-bold`}>[{log.agent}]</span>
              <span className="text-[#F1F1ED]">{log.message}</span>
            </div>
          );
        })}

        {/* Status line */}
        <div className="flex items-start gap-2 text-[#C0C9C1] mt-1">
          <span className="text-[#B7EFD0] font-bold">[TESTER]</span>
          <span className="text-[#F1F1ED] flex items-center gap-1">
            Synthesizing network abort under in-flight charge...
            <span className="w-2 h-3.5 bg-[#B7EFD0] inline-block animate-pulse"></span>
          </span>
        </div>
      </div>

      {/* Quick Directives */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1">
        <span className="text-[10px] text-[#717973] uppercase font-bold shrink-0">Directives:</span>
        {[
          'status',
          'pause',
          'resume',
          'fuzz checkout',
          'inspect-dom',
          'help',
        ].map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() => {
              setInputVal(cmd);
            }}
            className="text-[10px] bg-[#1A1C1A] text-[#B7EFD0] border border-[#717973] px-2 py-0.5 hover:bg-[#285C45] hover:text-white transition-colors shrink-0 whitespace-nowrap cursor-pointer"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Command Input Strip */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#717973]">
        <span className="text-[#B7EFD0] font-bold text-[14px]">&gt;</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
          placeholder="Inject live directive (e.g. status, pause, resume, fuzz checkout)..."
          className="flex-1 bg-[#1A1C1A] border border-[#717973] px-3 py-1.5 text-[12px] font-mono text-[#F1F1ED] placeholder:text-[#717973] focus:outline-none focus:border-[#B7EFD0]"
          disabled={isSending}
        />
        <button
          onClick={handleSendCommand}
          disabled={isSending}
          className="bg-[#285C45] text-white border border-[#1A1C1A] px-3 py-1.5 text-[11px] uppercase font-mono font-bold hover:bg-[#0B442F] shadow-xs active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

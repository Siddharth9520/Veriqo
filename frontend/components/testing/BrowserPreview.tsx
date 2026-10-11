'use client';

import React from 'react';

interface BrowserPreviewProps {
  onInspectEvidence?: () => void;
}

export default function BrowserPreview({ onInspectEvidence }: BrowserPreviewProps) {
  const [simulatedClick, setSimulatedClick] = React.useState(false);

  const handleTestClick = () => {
    setSimulatedClick(true);
    setTimeout(() => setSimulatedClick(false), 2000);
  };
  return (
    <div className="flex flex-col gap-4">
      {/* Browser Chrome Shell */}
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg flex flex-col overflow-hidden">
        {/* Top Window Bar */}
        <div className="bg-[#E8E8E5] border-b-2 border-[#1A1C1A] px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FD6E5B] border border-[#1A1C1A] inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#EBC162] border border-[#1A1C1A] inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#B7EFD0] border border-[#1A1C1A] inline-block"></span>
            </div>

            <div className="bg-[#FFFFFF] border border-[#1A1C1A] px-3 py-1 flex items-center gap-2 brutal-shadow-sm">
              <span className="material-symbols-outlined text-[#285C45] text-[16px]">shopping_cart</span>
              <span className="font-mono text-[12px] text-[#1A1C1A] font-semibold truncate max-w-[200px]">
                Checkout · Payment Finalize
              </span>
              <span className="material-symbols-outlined text-[#717973] text-[14px]">close</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#1A1C1A] font-semibold bg-[#EEEEEA] border border-[#1A1C1A] px-2 py-0.5">
            <span className="material-symbols-outlined text-[15px] text-[#285C45]">tab</span>
            <span>INSPECTOR ATTACHED</span>
          </div>
        </div>

        {/* Address & Status Bar */}
        <div className="bg-[#F4F4F0] border-b-2 border-[#1A1C1A] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-[#FFFFFF] border border-[#1A1C1A] px-3 py-1 shadow-inner">
            <span className="material-symbols-outlined text-[#285C45] text-[16px]">lock</span>
            <span className="font-mono text-[12px] text-[#1A1C1A] select-all truncate">
              https://shop-flow-staging.internal.app/checkout
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <div className="bg-[#E8E8E5] border border-[#717973] px-2 py-0.5 text-[#1A1C1A] font-semibold">
              1440x900 @ 60fps
            </div>
            <span className="flex items-center gap-1 text-[#0B442F] font-bold bg-[#B7EFD0] px-2 py-0.5 border border-[#1A1C1A]">
              <span className="w-2 h-2 rounded-full bg-[#285C45] animate-ping"></span>
              STREAMING
            </span>
          </div>
        </div>

        {/* Live DOM Stage */}
        <div className="relative bg-[#F4F4F0] min-h-[500px] p-4 sm:p-8 flex flex-col justify-between overflow-hidden">
          {/* Target App Simulation Card */}
          <div className="max-w-xl mx-auto w-full bg-[#FFFFFF] border-2 border-[#1A1C1A] p-6 brutal-shadow flex flex-col gap-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#0B442F] text-white flex items-center justify-center font-bold text-xs border border-[#1A1C1A]">
                  V
                </div>
                <span className="font-headline text-[18px] uppercase tracking-tight font-bold">
                  VogueCommerce
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#717973] font-semibold">STEP 3 OF 3</span>
            </div>

            <div className="bg-[#F4F4F0] border border-[#C0C9C1] p-3 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase font-bold text-[#404943]">Order Total</span>
                <span className="font-headline font-mono font-bold text-[#1A1C1A] text-[20px]">$249.00 USD</span>
              </div>
              <span className="font-mono text-[11px] bg-[#B7EFD0] text-[#002114] border border-[#1A1C1A] px-2 py-0.5 uppercase font-bold shadow-xs">
                In Stock
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[11px] uppercase font-bold text-[#404943]">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#E8E8E5] border border-[#1A1C1A] p-2 flex items-center gap-2 brutal-shadow-sm">
                  <span className="material-symbols-outlined text-[#285C45] text-[18px]">credit_card</span>
                  <span className="font-mono text-[12px] font-bold">Credit Card</span>
                </div>
                <div className="bg-[#F4F4F0] border border-[#C0C9C1] p-2 flex items-center gap-2 opacity-60">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  <span className="font-mono text-[12px]">Digital Wallet</span>
                </div>
              </div>
            </div>

            {/* Card Inputs */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[11px] uppercase font-bold text-[#404943]">Card Details</label>
              <div className="bg-[#E8E8E5] border border-[#C0C9C1] px-3 py-2 font-mono text-[12px] text-[#1A1C1A] flex justify-between">
                <span>•••• •••• •••• 4242</span>
                <span>12/28 · CVC •••</span>
              </div>
            </div>

            {/* Target Bound Area with Fuzzing Overlay */}
            <div className="relative mt-2">
              <div className="absolute -inset-2 bg-[#FD6E5B]/10 border-2 border-[#FD6E5B] pointer-events-none z-20 flex flex-col justify-between">
                <div className="self-start -mt-5 bg-[#FD6E5B] text-white border border-[#1A1C1A] px-2 py-0.5 font-mono text-[10px] font-bold brutal-shadow-sm uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">target</span>
                  [TARGET BOUND: #submit-payment-btn] CONFIDENCE: 99.4%
                </div>
                <div className="self-end -mb-5 bg-[#FFDF9B] text-[#4C3800] border border-[#1A1C1A] px-2 py-0.5 font-mono text-[10px] font-bold brutal-shadow-sm uppercase">
                  RACE-CONDITION TEST: ACTIVE
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestClick}
                className={`w-full border-2 border-[#1A1C1A] py-3 px-4 font-headline text-[15px] uppercase tracking-wide brutal-shadow flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  simulatedClick
                    ? 'bg-[#FD6E5B] text-white animate-pulse'
                    : 'bg-[#285C45] text-white hover:bg-[#0B442F]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {simulatedClick ? 'bolt' : 'lock'}
                </span>
                <span>
                  {simulatedClick
                    ? '⚡ CONCURRENT 2x POST DISPATCHED (Δ 12ms)'
                    : 'Pay $249.00 with Card'}
                </span>
              </button>
            </div>

            {/* Simulated Agent Pointer Overlay */}
            <div className="absolute top-[280px] right-[60px] z-30 pointer-events-none flex flex-col items-start transition-all duration-300 transform animate-bounce">
              <div className="flex items-center">
                <span className="material-symbols-outlined text-[#FD6E5B] text-[28px] drop-shadow-md">
                  near_me
                </span>
              </div>
              <div className="bg-[#191B19] text-[#F1F1ED] border border-[#717973] font-mono font-semibold text-[11px] px-2 py-1 brutal-shadow-sm whitespace-nowrap">
                Agent Action: Trigger double-click race condition (dt: 12ms)
              </div>
            </div>
          </div>

          {/* Fuzz Payload Banner */}
          <div className="w-full flex justify-center mt-4">
            <div className="bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-1.5 flex items-center gap-2 brutal-shadow font-mono text-[11px]">
              <span className="material-symbols-outlined text-[#FFDF9B] text-[16px]">memory</span>
              <span>Simulating payload: Tokenized Visa 4242-xxxx-xxxx-4242 · Nonce: _rnd_7f29a</span>
              <span className="w-2 h-2 rounded-full bg-[#B7EFD0] inline-block animate-ping"></span>
            </div>
          </div>
        </div>

        {/* DOM Telemetry Footer */}
        <div className="bg-[#E2E3DF] border-t-2 border-[#1A1C1A] px-4 py-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[12px] text-[#1A1C1A]">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#717973]">account_tree</span>
              <span>DOM Nodes: <strong className="font-bold">1,420 parsed</strong></span>
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#285C45]">speed</span>
              <span>Latency: <strong className="font-bold">34ms</strong></span>
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#717973]">cookie</span>
              <span>Active Cookies: <strong className="font-bold">4</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#F4F4F0] border border-[#1A1C1A] px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-[#B7EFD0] border border-[#1A1C1A]"></span>
            <span className="font-bold uppercase text-[11px]">Network: IDLE_WAIT</span>
          </div>
        </div>
      </div>

      {/* Heuristic Matrix Summary 3-Box Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-3 brutal-shadow flex flex-col justify-between">
          <span className="font-mono text-[11px] uppercase text-[#404943] font-bold">Idempotency Checks</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-headline font-mono text-[20px] text-[#AC3326] font-bold">1 / 4 PASS</span>
            <button
              onClick={onInspectEvidence}
              className="font-mono text-[10px] text-[#FD6E5B] bg-[#FFDAD6] border border-[#1A1C1A] px-1.5 py-0.5 font-bold hover:bg-[#FFDAD5] cursor-pointer"
              title="Click to inspect idempotency evidence"
            >
              CRITICAL REGRESSION
            </button>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-3 brutal-shadow flex flex-col justify-between">
          <span className="font-mono text-[11px] uppercase text-[#404943] font-bold">Form State Mutations</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-headline font-mono text-[20px] text-[#0B442F] font-bold">14 / 14</span>
            <span className="font-mono text-[10px] text-[#0B442F] bg-[#B7EFD0] border border-[#1A1C1A] px-1.5 py-0.5 font-bold">
              100% OK
            </span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-3 brutal-shadow flex flex-col justify-between">
          <span className="font-mono text-[11px] uppercase text-[#404943] font-bold">Accessibility (ARIA)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-headline font-mono text-[20px] text-[#1A1C1A] font-bold">27 / 29</span>
            <span className="font-mono text-[10px] text-[#404943] bg-[#E8E8E5] border border-[#717973] px-1.5 py-0.5 font-bold">
              2 WARN
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

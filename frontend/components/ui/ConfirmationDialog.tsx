import React from 'react';
import { Icon } from '@/components/ui/Icons';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-2xl brutal-shadow-lg max-w-md w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center gap-2">
          <Icon
            name={isDestructive ? 'warning' : 'help'}
            className={`w-6 h-6 ${
              isDestructive ? 'text-[#AC3326]' : 'text-[#285C45]'
            }`}
          />
          <h3 className="font-headline font-bold text-[18px] uppercase text-[#1A1C1A]">
            {title}
          </h3>
        </div>

        <p className="font-body text-[13px] text-[#404943] leading-relaxed">
          {description}
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E3DF]">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[#FAF9F6] border-2 border-[#1A1C1A] rounded-lg font-headline text-[12px] uppercase font-bold brutal-shadow-xs hover:bg-[#E8E8E5] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white border-2 border-[#1A1C1A] rounded-lg font-headline text-[12px] uppercase font-bold brutal-shadow-xs brutal-btn ${
              isDestructive
                ? 'bg-[#AC3326] hover:bg-[#93000A]'
                : 'bg-[#285C45] hover:bg-[#0B442F]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

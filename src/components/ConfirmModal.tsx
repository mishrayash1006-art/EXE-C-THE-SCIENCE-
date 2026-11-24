import React, { useState } from 'react';
import { AlertCircle, ShieldCheck, X } from 'lucide-react';
import { WorkspaceConfirmState } from '../types/studio';

interface ConfirmModalProps {
  state: WorkspaceConfirmState;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ state, onClose }) => {
  const [busy, setBusy] = useState(false);

  if (!state.isOpen) return null;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await state.onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#111827] border border-slate-700/80 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {state.destructive ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            )}
            <h3 id="confirm-modal-title" className="font-display text-base font-semibold text-slate-100">
              {state.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md cursor-pointer"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-300 leading-relaxed">{state.description}</p>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#0D131F] border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
              state.destructive
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
            }`}
          >
            {busy ? 'Processing...' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

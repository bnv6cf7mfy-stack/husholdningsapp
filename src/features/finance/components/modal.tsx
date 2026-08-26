"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Minimal reusable modal dialog: closes on Escape or backdrop click. No new UI dependency. */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
          >
            Lukk
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

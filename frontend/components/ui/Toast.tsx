"use client";

import { useEffect } from "react";

export type ToastTone = "success" | "error" | "info";

const toneStyles: Record<ToastTone, string> = {
  success: "border-success/35 bg-surface-elevated text-success",
  error: "border-danger/35 bg-surface-elevated text-danger",
  info: "border-border-strong bg-surface-elevated text-fg",
};

interface ToastProps {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({
  message,
  tone = "info",
  onDismiss,
  durationMs = 4200,
}: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  return (
    <div
      role="status"
      className={`absolute left-1/2 top-3 z-50 max-w-lg -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm shadow-[0_8px_24px_var(--shadow)] ${toneStyles[tone]}`}
    >
      {message}
    </div>
  );
}

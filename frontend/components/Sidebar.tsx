"use client";

import BlindSpotPanel from "@/components/BlindSpotPanel";
import { CANCER_TYPES } from "@/lib/constants";
import type { BlindspotData } from "@/lib/types";

type SidebarMode = "slim" | "explore" | "compare";

interface SidebarProps {
  mode: SidebarMode;
  panelSize: number;
  cancerType: string;
  elbowSize?: number;
  loading?: boolean;
  isManualMode?: boolean;
  manualCoverage?: number;
  blindspot?: BlindspotData;
  onPanelSizeChange: (size: number) => void;
  onCancerTypeChange: (type: string) => void;
  onResetToOptimal?: () => void;
}

export default function Sidebar({
  mode,
  panelSize,
  cancerType,
  elbowSize,
  loading,
  isManualMode,
  manualCoverage,
  blindspot,
  onPanelSizeChange,
  onCancerTypeChange,
  onResetToOptimal,
}: SidebarProps) {
  return (
    <aside
      className={`reveal flex h-full w-full flex-col gap-3 overflow-hidden border-r border-border bg-surface p-4 shadow-[2px_0_12px_var(--shadow)] ${
        mode === "slim" ? "items-center justify-center" : ""
      }`}
    >
      <header
        className={`reveal reveal-delay-1 shrink-0 ${mode === "slim" ? "" : "border-b border-border pb-3"}`}
      >
        <h1
          className="text-xl font-semibold tracking-tight text-fg"
          style={{ fontFamily: "var(--font-display)" }}
        >
          TINA
        </h1>
      </header>

      {mode === "explore" && (
        <>
          <section className="reveal reveal-delay-2 shrink-0 space-y-2">
            <label className="block text-sm text-fg-muted">
              Panel size:{" "}
              <span className="font-mono font-medium text-fg">{panelSize}</span>
            </label>
            <input
              type="range"
              min={2}
              max={15}
              value={panelSize}
              onChange={(e) => onPanelSizeChange(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-fg-subtle">
              {loading
                ? "Computing elbow…"
                : elbowSize != null
                  ? `Suggested optimal: ${elbowSize} lines`
                  : "Suggested optimal: 8 lines (elbow TBD)"}
            </p>
            {isManualMode && (
              <div className="space-y-2 rounded-lg border border-accent-teal/30 bg-accent-teal/8 p-3">
                <p className="text-xs text-accent">
                  Manual mode — coverage:{" "}
                  <span className="font-mono font-medium">
                    {manualCoverage != null ? manualCoverage.toFixed(3) : "—"}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onResetToOptimal}
                  className="btn-ghost w-full px-3 py-1.5 text-xs"
                >
                  Reset to optimal
                </button>
              </div>
            )}
          </section>

          <div className="reveal reveal-delay-3 min-h-0 shrink-0 overflow-hidden">
            <BlindSpotPanel
              blindspot={blindspot}
              panelSize={panelSize}
              loading={loading}
            />
          </div>

          <section className="reveal reveal-delay-3 shrink-0 space-y-1.5">
            <label htmlFor="cancer-type" className="block text-sm text-fg-muted">
              Cancer type
            </label>
            <select
              id="cancer-type"
              value={cancerType}
              onChange={(e) => onCancerTypeChange(e.target.value)}
              className="input-base w-full px-3 py-2 text-sm"
            >
              {CANCER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "all" ? "All cancer types" : type}
                </option>
              ))}
            </select>
          </section>
        </>
      )}

      {mode === "compare" && (
        <section className="reveal reveal-delay-2 shrink-0 space-y-2">
          <label className="block text-sm text-fg-muted">
            Panel size:{" "}
            <span className="font-mono font-medium text-fg">{panelSize}</span>
          </label>
          <input
            type="range"
            min={2}
            max={15}
            value={panelSize}
            onChange={(e) => onPanelSizeChange(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-fg-subtle">
            {loading
              ? "Computing elbow…"
              : elbowSize != null
                ? `Suggested optimal: ${elbowSize} lines`
                : "Suggested optimal: 8 lines (elbow TBD)"}
          </p>
        </section>
      )}
    </aside>
  );
}

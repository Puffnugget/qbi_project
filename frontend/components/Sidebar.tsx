"use client";

import BlindSpotPanel from "@/components/BlindSpotPanel";
import { CANCER_TYPES, OMICS_LAYERS } from "@/lib/constants";
import type { BlindspotData } from "@/lib/types";

interface SidebarProps {
  panelSize: number;
  cancerType: string;
  activeLayers: string[];
  elbowSize?: number;
  loading?: boolean;
  isManualMode?: boolean;
  manualCoverage?: number;
  blindspot?: BlindspotData;
  onPanelSizeChange: (size: number) => void;
  onCancerTypeChange: (type: string) => void;
  onLayerToggle: (layer: string) => void;
  onResetToOptimal?: () => void;
}

export default function Sidebar({
  panelSize,
  cancerType,
  activeLayers,
  elbowSize,
  loading,
  isManualMode,
  manualCoverage,
  blindspot,
  onPanelSizeChange,
  onCancerTypeChange,
  onLayerToggle,
  onResetToOptimal,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col gap-6 overflow-y-auto border-r border-white/10 bg-[#0a0a18] p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          NCI-60 Panel Builder
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">
          Greedy Selection
        </h1>
      </header>

      <section className="space-y-3">
        <label className="block text-sm text-zinc-400">
          Panel size:{" "}
          <span className="font-mono text-zinc-100">{panelSize}</span>
        </label>
        <input
          type="range"
          min={2}
          max={15}
          value={panelSize}
          onChange={(e) => onPanelSizeChange(Number(e.target.value))}
          className="w-full accent-[#4361EE]"
        />
        <p className="text-xs text-zinc-500">
          {loading
            ? "Computing elbow…"
            : elbowSize != null
              ? `Suggested optimal: ${elbowSize} lines`
              : "Suggested optimal: 8 lines (elbow TBD)"}
        </p>
        {isManualMode && (
          <div className="space-y-2">
            <p className="text-xs text-cyan-400">
              Manual mode — coverage:{" "}
              <span className="font-mono">
                {manualCoverage != null ? manualCoverage.toFixed(3) : "—"}
              </span>
            </p>
            <button
              type="button"
              onClick={onResetToOptimal}
              className="w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20"
            >
              Reset to Optimal
            </button>
          </div>
        )}
      </section>

      <BlindSpotPanel blindspot={blindspot} panelSize={panelSize} />

      <section className="space-y-2">
        <label htmlFor="cancer-type" className="block text-sm text-zinc-400">
          Cancer type
        </label>
        <select
          id="cancer-type"
          value={cancerType}
          onChange={(e) => onCancerTypeChange(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-[#050510] px-3 py-2 text-sm text-zinc-100"
        >
          {CANCER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "All cancer types" : type}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <p className="text-sm text-zinc-400">Omics layers</p>
        <div className="space-y-2">
          {OMICS_LAYERS.map((layer) => (
            <label
              key={layer}
              className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300"
            >
              <input
                type="checkbox"
                checked={activeLayers.includes(layer)}
                onChange={() => onLayerToggle(layer)}
                className="rounded border-white/20 accent-[#4361EE]"
              />
              {layer}
            </label>
          ))}
        </div>
      </section>
    </aside>
  );
}

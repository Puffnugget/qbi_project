"use client";

import { CANCER_COLORS } from "@/lib/constants";
import type { BlindspotData, PanelBlindspot } from "@/lib/types";

interface BlindSpotPanelProps {
  blindspot?: BlindspotData;
  panelSize?: number;
}

function statusColor(fraction: number, selected: number): string {
  if (selected === 0) return "#EF233C";
  if (fraction < 0.5) return "#FCBF49";
  return "#06D6A0";
}

export default function BlindSpotPanel({
  blindspot,
  panelSize = 8,
}: BlindSpotPanelProps) {
  const report: PanelBlindspot | undefined =
    blindspot?.by_panel_size[String(panelSize)];
  const pathwayGaps =
    blindspot?.pathway_gaps_by_size?.[String(panelSize)] ?? [];

  if (!report) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0a0a18] p-3 text-xs text-zinc-500">
        Blind spot analysis loading…
      </div>
    );
  }

  const missing = report.missing_types;

  return (
    <section className="space-y-3">
      {missing.length > 0 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Blind to: {missing.join(", ")}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Cancer type coverage
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(report.types).map(([type, info]) => {
            const color = statusColor(info.fraction, info.selected);
            const accent = CANCER_COLORS[type] ?? color;
            return (
              <div
                key={type}
                className="rounded border border-white/10 px-2 py-1.5"
                style={{
                  backgroundColor: `${color}18`,
                  borderColor: `${color}40`,
                }}
              >
                <p className="text-[10px] font-medium" style={{ color: accent }}>
                  {type}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  {info.selected}/{info.total}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {pathwayGaps.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
            Pathway gaps (&gt;30%)
          </p>
          <ul className="space-y-1 text-xs text-zinc-400">
            {pathwayGaps.slice(0, 5).map((g) => (
              <li
                key={g.pathway}
                className="flex justify-between gap-2 rounded border border-white/5 px-2 py-1"
              >
                <span className="truncate">{g.pathway}</span>
                <span className="font-mono text-amber-400">
                  {Math.round(g.gap * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

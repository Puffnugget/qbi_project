"use client";

import { Card } from "@/components/ui/Card";
import { CANCER_COLORS } from "@/lib/constants";
import { blindspotStatusColor } from "@/lib/theme";
import type { BlindspotData, PanelBlindspot } from "@/lib/types";

interface BlindSpotPanelProps {
  blindspot?: BlindspotData;
  panelSize?: number;
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
      <Card padding="sm" className="text-xs text-fg-muted">
        Blind spot analysis loading…
      </Card>
    );
  }

  const missing = report.missing_types;

  return (
    <section className="space-y-3">
      {missing.length > 0 && (
        <div
          className="rounded-md border border-danger/35 bg-danger/8 px-3 py-2 text-xs text-danger"
        >
          Blind to: {missing.join(", ")}
        </div>
      )}

      <div>
        <p className="label-caps mb-2">Cancer type coverage</p>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(report.types).map(([type, info]) => {
            const color = blindspotStatusColor(info.fraction, info.selected);
            const accent = CANCER_COLORS[type] ?? color;
            return (
              <div
                key={type}
                className="rounded-md border px-2 py-1.5"
                style={{
                  backgroundColor: `${color}14`,
                  borderColor: `${color}40`,
                }}
              >
                <p className="text-[10px] font-medium" style={{ color: accent }}>
                  {type}
                </p>
                <p className="font-mono text-[10px] text-fg-muted">
                  {info.selected}/{info.total}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {pathwayGaps.length > 0 && (
        <div>
          <p className="label-caps mb-2">Pathway gaps (&gt;30%)</p>
          <ul className="space-y-1 text-xs text-fg-muted">
            {pathwayGaps.slice(0, 5).map((g) => (
              <li
                key={g.pathway}
                className="flex justify-between gap-2 rounded-md border border-border/60 bg-canvas-deep/40 px-2 py-1"
              >
                <span className="truncate">{g.pathway}</span>
                <span className="font-mono text-warning">
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

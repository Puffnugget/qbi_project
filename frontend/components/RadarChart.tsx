"use client";

import { EmptyState } from "@/components/ui/Card";
import { OMICS_LAYERS } from "@/lib/constants";
import { theme } from "@/lib/theme";
import type { PerLayerCoverage } from "@/lib/types";

interface RadarChartProps {
  perLayer?: PerLayerCoverage;
  panelSize?: number;
}

const SIZE = 140;
const CENTER = SIZE / 2;
const RADIUS = 52;

export default function RadarChart({ perLayer, panelSize = 8 }: RadarChartProps) {
  const values = perLayer?.[String(panelSize)] ?? {};
  const layers = [...OMICS_LAYERS];
  const hasData = layers.some((l) => values[l] != null);

  if (!hasData) {
    return (
      <EmptyState className="h-40 text-xs">
        Per-layer coverage — awaiting JSON
      </EmptyState>
    );
  }

  const angleStep = (2 * Math.PI) / layers.length;

  const points = layers
    .map((layer, i) => {
      const v = Math.min(1, Math.max(0, values[layer] ?? 0));
      const angle = -Math.PI / 2 + i * angleStep;
      const x = CENTER + RADIUS * v * Math.cos(angle);
      const y = CENTER + RADIUS * v * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  const axisLines = layers.map((layer, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x2 = CENTER + RADIUS * Math.cos(angle);
    const y2 = CENTER + RADIUS * Math.sin(angle);
    const lx = CENTER + (RADIUS + 14) * Math.cos(angle);
    const ly = CENTER + (RADIUS + 14) * Math.sin(angle);
    return { layer, x2, y2, lx, ly };
  });

  return (
    <div className="card p-3">
      <p className="label-caps mb-2">Layer coverage (k={panelSize})</p>
      <svg width={SIZE} height={SIZE} className="mx-auto block">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <circle
            key={ring}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS * ring}
            fill="none"
            stroke={theme.border}
            strokeWidth={1}
          />
        ))}
        {axisLines.map(({ layer, x2, y2, lx, ly }) => (
          <g key={layer}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={x2}
              y2={y2}
              stroke={theme.borderStrong}
              strokeWidth={1}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={theme.fgMuted}
              fontSize={8}
            >
              {layer.slice(0, 4)}
            </text>
          </g>
        ))}
        <polygon
          points={points}
          fill={`${theme.accent}30`}
          stroke={theme.accent}
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}

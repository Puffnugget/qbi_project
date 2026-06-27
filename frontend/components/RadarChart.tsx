"use client";

import type { PerLayerCoverage } from "@/lib/types";
import { OMICS_LAYERS } from "@/lib/constants";

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
      <div className="flex h-40 items-center justify-center rounded-lg border border-white/10 bg-[#0a0a18] text-xs text-zinc-500">
        Per-layer coverage — awaiting JSON
      </div>
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
    <div className="rounded-lg border border-white/10 bg-[#0a0a18] p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
        Layer coverage (k={panelSize})
      </p>
      <svg width={SIZE} height={SIZE} className="mx-auto block">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <circle
            key={ring}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS * ring}
            fill="none"
            stroke="#1a1a2e"
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
              stroke="#2a2a3e"
              strokeWidth={1}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#71717a"
              fontSize={8}
            >
              {layer.slice(0, 4)}
            </text>
          </g>
        ))}
        <polygon
          points={points}
          fill="rgba(67,97,238,0.25)"
          stroke="#4361EE"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}

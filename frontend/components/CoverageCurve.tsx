"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CoveragePoint } from "@/lib/types";

interface CoverageCurveProps {
  data?: CoveragePoint[];
  currentPanelSize?: number;
  elbowSize?: number;
}

export default function CoverageCurve({
  data = [],
  currentPanelSize = 8,
  elbowSize,
}: CoverageCurveProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-white/10 bg-[#0a0a18] text-sm text-zinc-500">
        Coverage curve — awaiting precomputed JSON
      </div>
    );
  }

  return (
    <div className="h-48 rounded-lg border border-white/10 bg-[#0a0a18] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
          <XAxis
            dataKey="panel_size"
            stroke="#71717a"
            tick={{ fill: "#71717a", fontSize: 11 }}
          />
          <YAxis stroke="#71717a" tick={{ fill: "#71717a", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#0a0a18",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
          <Line
            type="monotone"
            dataKey="coverage"
            stroke="#4361EE"
            strokeWidth={2}
            dot={false}
            name="Coverage"
          />
          <Line
            type="monotone"
            dataKey="validation_r"
            stroke="#06D6A0"
            strokeWidth={2}
            dot={false}
            name="Drug prediction r"
          />
          {elbowSize != null && (
            <ReferenceLine
              x={elbowSize}
              stroke="#71717a"
              strokeDasharray="4 4"
            />
          )}
          <ReferenceLine
            x={currentPanelSize}
            stroke="#FFD700"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

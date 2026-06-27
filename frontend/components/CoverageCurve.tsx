"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/Card";
import { chartTheme } from "@/lib/theme";
import type { CoveragePoint } from "@/lib/types";

interface CoverageCurveProps {
  data?: CoveragePoint[];
  currentPanelSize?: number;
  elbowSize?: number;
  manualDot?: { panelSize: number; coverage: number };
}

export default function CoverageCurve({
  data = [],
  currentPanelSize = 8,
  elbowSize,
  manualDot,
}: CoverageCurveProps) {
  if (data.length === 0) {
    return (
      <EmptyState className="h-48 text-sm">
        Coverage curve — awaiting precomputed JSON
      </EmptyState>
    );
  }

  return (
    <div className="card h-48 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid
            stroke={chartTheme.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="panel_size"
            stroke={chartTheme.axis}
            tick={{ fill: chartTheme.axis, fontSize: 11 }}
          />
          <YAxis
            stroke={chartTheme.axis}
            tick={{ fill: chartTheme.axis, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltipBg,
              border: `1px solid ${chartTheme.tooltipBorder}`,
              borderRadius: "8px",
              color: chartTheme.axis,
            }}
          />
          <Line
            type="monotone"
            dataKey="coverage"
            stroke={chartTheme.coverage}
            strokeWidth={2}
            dot={false}
            name="Coverage"
          />
          <Line
            type="monotone"
            dataKey="validation_r"
            stroke={chartTheme.validation}
            strokeWidth={2}
            dot={false}
            name="Drug prediction r"
          />
          {elbowSize != null && (
            <ReferenceLine
              x={elbowSize}
              stroke={chartTheme.reference}
              strokeDasharray="4 4"
            />
          )}
          <ReferenceLine
            x={currentPanelSize}
            stroke={chartTheme.currentLine}
            strokeWidth={2}
          />
          {manualDot && (
            <ReferenceDot
              x={manualDot.panelSize}
              y={manualDot.coverage}
              r={6}
              fill={chartTheme.manualDot}
              stroke={chartTheme.tooltipBg}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

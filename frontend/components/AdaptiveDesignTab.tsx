"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { chartTheme } from "@/lib/theme";
import type { AdaptiveDesignData, UmapPoint } from "@/lib/types";

const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

const POLICIES = ["coverage_greedy", "uncertainty", "thompson", "random"];

export default function AdaptiveDesignTab({
  umapPoints = [],
  adaptiveData = null,
}: {
  umapPoints?: UmapPoint[];
  adaptiveData?: AdaptiveDesignData | null;
}) {
  const [data, setData] = useState<AdaptiveDesignData | null>(adaptiveData);
  const [policy, setPolicy] = useState("coverage_greedy");
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (adaptiveData) setData(adaptiveData);
  }, [adaptiveData]);

  useEffect(() => {
    if (data || adaptiveData) return;
    fetch("/precomputed/adaptive_design.json")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("missing adaptive_design.json")),
      )
      .then(setData)
      .catch(() => setData(null));
  }, [data, adaptiveData]);

  const rollout =
    data?.policies[policy] ??
    data?.policies.coverage_greedy ??
    Object.values(data?.policies ?? {})[0];
  const maxStep = rollout?.selections.length ?? 1;
  const selectedLines = rollout?.selections.slice(0, step) ?? [];

  useEffect(() => {
    if (!playing || !rollout) return;
    if (step >= maxStep) {
      const id = window.setTimeout(() => setPlaying(false), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), 500);
    return () => window.clearTimeout(id);
  }, [playing, rollout, step, maxStep]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: data.target_size }, (_, i) => {
      const row: Record<string, number> = { step: i + 1 };
      for (const key of POLICIES) {
        row[key] = data.policies[key]?.curve[i]?.median_r ?? 0;
      }
      return row;
    });
  }, [data]);

  if (!data || !rollout) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-fg-muted">
        Run{" "}
        <span className="mx-1 font-mono text-accent">python src/adaptive_design.py</span>
        to generate adaptive-design rollouts.
      </div>
    );
  }

  return (
    <div className="grid h-full grid-rows-[1fr_260px]">
      <div className="min-h-0 p-3">
        <div className="h-full overflow-hidden rounded-xl border border-border shadow-[0_4px_24px_var(--shadow-strong)]">
          <Scene3D
            points={umapPoints}
            selectedLines={selectedLines}
            greedyLines={selectedLines}
          />
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 border-t border-border bg-surface/60 p-4">
        <Card>
          <p className="label-caps">Adaptive design replay</p>
          <p className="mt-2 text-sm text-fg-muted">{data.metric}</p>
          <div className="mt-4 grid gap-2">
            {POLICIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPolicy(p);
                  setStep(1);
                  setPlaying(false);
                }}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  policy === p
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
                }`}
              >
                {p.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              className="btn-primary px-3 py-2 text-sm"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setPlaying(false);
              }}
              className="btn-ghost px-3 py-2 text-sm"
            >
              Reset
            </button>
            <span className="self-center text-sm text-fg-subtle">
              Step {step}/{maxStep}
            </span>
          </div>
        </Card>

        <Card className="min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="step"
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
                }}
              />
              {POLICIES.map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  stroke={chartTheme.policies[p as keyof typeof chartTheme.policies]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

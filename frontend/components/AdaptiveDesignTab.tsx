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
import { fetchAdaptiveDesign, isAdaptiveDesignReady } from "@/lib/data";
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
  const [data, setData] = useState<AdaptiveDesignData | null>(
    isAdaptiveDesignReady(adaptiveData) ? adaptiveData : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [policy, setPolicy] = useState("coverage_greedy");
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (isAdaptiveDesignReady(adaptiveData)) {
      setData(adaptiveData);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadError(null);

    fetchAdaptiveDesign()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setData(null);
          setLoadError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adaptiveData]);

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
        const raw = data.policies[key]?.curve[i]?.median_r ?? 0;
        row[key] = Number.isFinite(raw) ? raw : 0;
      }
      return row;
    });
  }, [data]);

  if (!isAdaptiveDesignReady(data) || !rollout) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-fg-muted">
        <p>
          Folklore loads from the FastAPI backend via uvicorn.
        </p>
        <ol className="max-w-md space-y-2 text-left font-mono text-xs text-accent">
          <li>1. python src/adaptive_design.py</li>
          <li>2. ./scripts/run_api.sh</li>
          <li>3. cd frontend && npm run dev</li>
        </ol>
        {loadError && (
          <p className="max-w-md text-xs text-danger">{loadError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[6fr_4fr] overflow-hidden">
      <div className="min-h-0 px-3 pt-2">
        <div className="h-full overflow-hidden rounded-lg border border-border shadow-[0_2px_12px_var(--shadow)]">
          <Scene3D
            points={umapPoints}
            selectedLines={selectedLines}
            greedyLines={selectedLines}
            compact
          />
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[3fr_7fr] items-stretch gap-2 overflow-hidden border-t border-border bg-surface/60 px-3 py-2">
        <Card className="flex h-fit max-h-full w-full flex-col self-start overflow-auto p-2.5">
          <p className="label-caps shrink-0">Folklore screening replay</p>
          <p className="mt-1 shrink-0 text-xs text-fg-muted">{data.metric}</p>
          <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">
            {POLICIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPolicy(p);
                  setStep(1);
                  setPlaying(false);
                }}
                className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  policy === p
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
                }`}
              >
                {p.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="mt-2 flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              className="btn-primary px-2.5 py-1.5 text-xs"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setPlaying(false);
              }}
              className="btn-ghost px-2.5 py-1.5 text-xs"
            >
              Reset
            </button>
            <span className="self-center text-xs text-fg-subtle">
              Step {step}/{maxStep}
            </span>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-2">
          <div className="min-h-0 flex-1">
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
                domain={["auto", "auto"]}
                tickFormatter={(v) => v.toFixed(2)}
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
          </div>
        </Card>
      </div>
    </div>
  );
}

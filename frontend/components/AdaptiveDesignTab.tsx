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
import type { AdaptiveDesignData, UmapPoint } from "@/lib/types";

const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

const POLICIES = ["coverage_greedy", "uncertainty", "thompson", "random"];

export default function AdaptiveDesignTab({
  umapPoints = [],
}: {
  umapPoints?: UmapPoint[];
}) {
  const [data, setData] = useState<AdaptiveDesignData | null>(null);
  const [policy, setPolicy] = useState("coverage_greedy");
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch("/precomputed/adaptive_design.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing adaptive_design.json"))))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const rollout = data?.policies[policy];
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
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Run <span className="mx-1 font-mono">python src/adaptive_design.py</span> to generate adaptive-design rollouts.
      </div>
    );
  }

  return (
    <div className="grid h-full grid-rows-[1fr_260px] bg-[#050510]">
      <div className="min-h-0">
        <Scene3D
          points={umapPoints}
          selectedLines={selectedLines}
          greedyLines={selectedLines}
        />
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 border-t border-white/10 p-4">
        <div className="rounded-lg border border-white/10 bg-[#0a0a18] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Adaptive design replay
          </p>
          <p className="mt-2 text-sm text-zinc-300">{data.metric}</p>
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
                className={`rounded border px-3 py-2 text-left text-sm ${
                  policy === p
                    ? "border-cyan-300 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 text-zinc-400 hover:text-zinc-200"
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
              className="rounded bg-[#FFD700] px-3 py-2 text-sm font-semibold text-black"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setPlaying(false);
              }}
              className="rounded border border-white/10 px-3 py-2 text-sm text-zinc-300"
            >
              Reset
            </button>
            <span className="self-center text-sm text-zinc-500">
              Step {step}/{maxStep}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0a0a18] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
              <XAxis dataKey="step" stroke="#71717a" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis stroke="#71717a" tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#0a0a18",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <Line type="monotone" dataKey="coverage_greedy" stroke="#FFD700" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="uncertainty" stroke="#06D6A0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="thompson" stroke="#00F5FF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="random" stroke="#EF233C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Card } from "@/components/ui/Card";
import { fetchFolklore, isFolkloreReady } from "@/lib/data";
import { chartTheme, theme } from "@/lib/theme";
import type { FolkloreData, UmapPoint } from "@/lib/types";

const POLICY_LABELS: Record<string, string> = {
  active_learner: "Active learner",
  random: "Random",
  greedy: "Greedy",
  uncertainty: "Uncertainty",
};

const RESPONSE_COLORS = {
  sensitive: theme.success,
  intermediate: theme.warning,
  resistant: theme.danger,
} as const;

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function score(value: number) {
  return value.toFixed(2);
}

export default function AdaptiveDesignTab({
  adaptiveData = null,
}: {
  umapPoints?: UmapPoint[];
  adaptiveData?: FolkloreData | null;
}) {
  const [data, setData] = useState<FolkloreData | null>(adaptiveData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"canned" | "live">("canned");
  const [caseId, setCaseId] = useState<string>("");
  const [policy, setPolicy] = useState("active_learner");
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (isFolkloreReady(adaptiveData)) {
      return;
    }

    let cancelled = false;
    fetchFolklore()
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setLoadError(null);
        }
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

  const resolvedData = adaptiveData ?? data;
  const cases = useMemo(() => resolvedData?.preset_cases ?? [], [resolvedData]);

  const currentCase = useMemo(
    () => cases.find((entry) => entry.id === caseId) ?? cases[0] ?? null,
    [caseId, cases],
  );

  const activePolicy =
    currentCase?.policies[policy] != null
      ? policy
      : Object.keys(currentCase?.policies ?? {})[0] ?? "active_learner";
  const rollout = currentCase?.policies[activePolicy] ?? null;
  const maxStep = rollout?.steps.length ?? 1;
  const clampedStep = Math.min(step, maxStep);
  const currentStep = rollout?.steps[clampedStep - 1] ?? null;
  const isAutoPlaying = playing && clampedStep < maxStep;

  useEffect(() => {
    if (!isAutoPlaying || !rollout) return;
    const id = window.setTimeout(() => setStep((value) => value + 1), 1100);
    return () => window.clearTimeout(id);
  }, [isAutoPlaying, rollout, clampedStep]);

  const chartData = useMemo(() => {
    if (!currentCase) return [];
    const keys = Object.keys(currentCase.policies);
    const budget = currentCase.budget;
    return Array.from({ length: budget }, (_, index) => {
      const row: Record<string, number> = { step: index + 1 };
      for (const key of keys) {
        const point = currentCase.policies[key].summary_curve[index];
        row[key] = point?.score ?? row[key] ?? 0;
      }
      return row;
    });
  }, [currentCase]);

  if (!isFolkloreReady(resolvedData) || !currentCase || !rollout || !currentStep) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-fg-muted">
        <p>Folklore is loading from `frontend/public/precomputed/folklore.json`.</p>
        {loadError && <p className="max-w-md text-xs text-danger">{loadError}</p>}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_14rem] gap-3 overflow-hidden p-3">
      <div className="grid min-h-0 gap-3 xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
        <Card className="reveal flex min-h-0 flex-col gap-4 overflow-auto p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Adaptive Tumor Screening</p>
              <h2 className="mt-1 font-display text-xl text-fg">{currentCase.tumor_name}</h2>
            </div>
            <div className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                  {mode === "canned" ? "Canned demo" : "Live soon"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("canned");
                setPlaying(false);
                setStep(1);
              }}
              className={`rounded-md border px-3 py-2 text-sm ${
                mode === "canned"
                  ? "border-accent bg-accent text-surface-elevated"
                  : "border-border bg-surface-elevated text-fg-muted"
              }`}
            >
              Canned demos
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("live");
                setPlaying(false);
                setStep(1);
              }}
              className={`rounded-md border px-3 py-2 text-sm ${
                mode === "live"
                  ? "border-accent bg-accent text-surface-elevated"
                  : "border-border bg-surface-elevated text-fg-muted"
              }`}
            >
              Run live
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Preset tumor</span>
            <select
              value={currentCase.id}
              onChange={(event) => {
                setCaseId(event.target.value);
                setPlaying(false);
                setStep(1);
              }}
              className="input-base px-3 py-2 text-sm"
            >
              {cases.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.tumor_name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-border bg-canvas/65 p-3">
            <p className="label-caps">Tumor hook</p>
            <p className="mt-2 text-sm leading-6 text-fg-muted">{currentCase.hook}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="label-caps">Goal</p>
              <p className="mt-2 text-sm font-medium text-fg">{currentCase.goal}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="label-caps">Budget</p>
              <p className="mt-2 text-sm font-medium text-fg">{currentCase.budget} drug tests</p>
            </div>
          </div>

          <div>
            <p className="label-caps">Tumor mixture</p>
            <div className="mt-2 space-y-2">
              {currentCase.components.map((component) => (
                <div
                  key={component.cell_line}
                  className="rounded-xl border border-border bg-surface-elevated p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-fg">{component.cell_line}</p>
                      <p className="text-xs text-fg-subtle">{component.cancer_type ?? "NCI-60 clone"}</p>
                    </div>
                    <span className="text-sm font-semibold text-accent">
                      {pct(component.proportion)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-canvas-deep">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${component.proportion * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mode === "live" && (
            <div className="rounded-xl border border-dashed border-border-strong bg-canvas-deep/60 p-3 text-sm text-fg-muted">
              Live inputs and `/folklore/run` are not wired yet. This tab is canned-first so the judge path exists before backend work.
            </div>
          )}
        </Card>

        <Card className="reveal reveal-delay-1 flex min-h-0 flex-col overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Screening timeline</p>
                <p className="mt-1 text-sm text-fg-muted">
                  {POLICY_LABELS[activePolicy] ?? activePolicy} is running step {clampedStep} of {maxStep}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(currentCase.policies).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPolicy(key);
                      setPlaying(false);
                      setStep(1);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      policy === key
                        ? "border-accent bg-accent/10 font-medium text-accent"
                        : "border-border text-fg-muted"
                    }`}
                  >
                    {POLICY_LABELS[key] ?? key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="min-h-0 overflow-auto pr-1">
              <div className="space-y-3">
                {rollout.steps.map((entry) => {
                  const isCurrent = entry.step === step;
                  const isPast = entry.step < step;
                  return (
                    <button
                      key={`${entry.compound}-${entry.step}`}
                      type="button"
                      onClick={() => {
                        setStep(entry.step);
                        setPlaying(false);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isCurrent
                          ? "border-accent bg-accent/8 shadow-[0_6px_18px_var(--shadow)]"
                          : isPast
                            ? "border-border-strong bg-surface-elevated"
                            : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="label-caps">Test {entry.step}</p>
                          <h3 className="mt-1 text-base font-semibold text-fg">{entry.compound}</h3>
                          <p className="text-xs text-fg-subtle">{entry.mechanism}</p>
                        </div>
                        <div className="rounded-full bg-canvas-deep px-2.5 py-1 text-xs font-medium text-fg-muted">
                          Mixed {score(entry.mixed_response)}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-fg-muted">{entry.why_chosen}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <div className="rounded-2xl border border-border bg-surface-elevated p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="label-caps">Current test</p>
                    <h3 className="mt-1 text-lg font-semibold text-fg">{currentStep.compound}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-fg-subtle">Best so far</p>
                    <p className="text-base font-semibold text-accent">
                      {score(currentStep.best_response_so_far)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (clampedStep >= maxStep) {
                        setStep(1);
                        setPlaying(true);
                        return;
                      }
                      setPlaying((value) => !value);
                    }}
                    className="btn-primary px-3 py-2 text-sm"
                  >
                    {isAutoPlaying ? "Pause replay" : clampedStep >= maxStep ? "Replay from start" : "Play replay"}
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
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-canvas/75 p-4">
                <p className="label-caps">Subclone responses</p>
                <div className="mt-3 space-y-3">
                  {currentStep.subclone_responses.map((response) => (
                    <div key={response.cell_line} className="rounded-xl bg-surface-elevated p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm text-fg">{response.cell_line}</p>
                          <p
                            className="text-xs font-medium capitalize"
                            style={{ color: RESPONSE_COLORS[response.label] }}
                          >
                            {response.label}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-fg">{score(response.response)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="reveal reveal-delay-2 flex min-h-0 flex-col gap-3 overflow-auto bg-[linear-gradient(180deg,rgba(47,94,69,0.08),rgba(47,94,69,0))] p-4">
          <div>
            <p className="label-caps">Final recommendation</p>
            <h2 className="mt-1 text-2xl font-display text-fg">
              {rollout.final.recommended_compound}
            </h2>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <p className="label-caps">Main realization</p>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              {rollout.final.main_realization}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <p className="label-caps">Next experiment</p>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              {rollout.final.next_experiment}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-accent text-surface-elevated p-4">
            <p className="label-caps !text-[#dce9e2]">Active vs random</p>
            <p className="mt-2 text-sm leading-6">{rollout.final.active_vs_random}</p>
          </div>
        </Card>
      </div>

      <Card className="reveal reveal-delay-3 min-h-0 overflow-hidden p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="label-caps">Policy comparison</p>
            <p className="mt-1 text-sm text-fg-muted">
              Stronger downward score means the policy found a more useful compound sooner.
            </p>
          </div>
        </div>
        <div className="h-[11rem]">
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
                tickFormatter={score}
              />
              <Tooltip
                formatter={(value, name) => {
                  const numeric = typeof value === "number" ? value : Number(value ?? 0);
                  const label = typeof name === "string" ? name : String(name);
                  return [score(numeric), POLICY_LABELS[label] ?? label];
                }}
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine x={clampedStep} stroke={theme.accentGold} strokeDasharray="4 4" />
              {Object.keys(currentCase.policies).map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartTheme.policies[key as keyof typeof chartTheme.policies] ?? theme.accent}
                  strokeWidth={key === activePolicy ? 3 : 2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

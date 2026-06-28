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
import {
  fetchFolklore,
  fetchFolkloreCatalog,
  isFolkloreReady,
  regenerateFolklore,
  runFolklore,
} from "@/lib/data";
import { chartTheme, theme } from "@/lib/theme";
import type {
  FolkloreCase,
  FolkloreCatalog,
  FolkloreData,
  UmapPoint,
} from "@/lib/types";

type Goal = FolkloreCase["goal"];
const GOALS: Goal[] = ["find responder", "find resistance", "find robust drug"];

interface LiveComponentDraft {
  cell_line: string;
  proportion: number;
}

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

  // Live mode state
  const [catalog, setCatalog] = useState<FolkloreCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [liveComponents, setLiveComponents] = useState<LiveComponentDraft[]>([
    { cell_line: "", proportion: 0.5 },
    { cell_line: "", proportion: 0.5 },
  ]);
  const [liveGoal, setLiveGoal] = useState<Goal>("find resistance");
  const [liveBudget, setLiveBudget] = useState(6);
  const [drugSearch, setDrugSearch] = useState("");
  const [mechFilter, setMechFilter] = useState("all");
  const [drugPool, setDrugPool] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [liveCase, setLiveCase] = useState<FolkloreCase | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (toast == null) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Rebuild folklore.json from real simulator output, then reload the presets.
  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerateFolklore();
      const payload = await fetchFolklore();
      setData(payload);
      setLoadError(null);
      setPlaying(false);
      setStep(1);
      setToast(
        `Regenerated ${result.preset_count} presets from simulator output.`,
      );
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  // Load the live catalog the first time the user opens live mode.
  useEffect(() => {
    if (mode !== "live" || catalog != null) return;
    let cancelled = false;
    fetchFolkloreCatalog()
      .then((payload) => {
        if (!cancelled) {
          setCatalog(payload);
          setCatalogError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setCatalogError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, catalog]);

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

  const presetCase = useMemo(
    () => cases.find((entry) => entry.id === caseId) ?? cases[0] ?? null,
    [caseId, cases],
  );
  const currentCase =
    mode === "live" && liveCase != null ? liveCase : presetCase;

  // --- Live form validation ---
  const proportionSum = liveComponents.reduce(
    (acc, c) => acc + (Number.isFinite(c.proportion) ? c.proportion : 0),
    0,
  );
  const cellLines = liveComponents.map((c) => c.cell_line).filter(Boolean);
  const hasDuplicateLines = new Set(cellLines).size !== cellLines.length;
  const liveErrors = useMemo(() => {
    const errs: string[] = [];
    if (liveComponents.length < 2) errs.push("Pick at least 2 subclones.");
    if (cellLines.length !== liveComponents.length)
      errs.push("Every subclone needs a cell line.");
    if (hasDuplicateLines) errs.push("Subclones must be distinct cell lines.");
    if (Math.abs(proportionSum - 1) > 0.01)
      errs.push(`Proportions must sum to 1.0 (now ${proportionSum.toFixed(2)}).`);
    return errs;
  }, [liveComponents, cellLines.length, hasDuplicateLines, proportionSum]);
  const canRunLive = liveErrors.length === 0 && !running;

  const filteredDrugs = useMemo(() => {
    const drugs = catalog?.drugs ?? [];
    const q = drugSearch.trim().toLowerCase();
    return drugs.filter((d) => {
      if (mechFilter !== "all" && d.mechanism !== mechFilter) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, drugSearch, mechFilter]);

  function updateComponent(index: number, patch: Partial<LiveComponentDraft>) {
    setLiveComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }
  function addComponent() {
    setLiveComponents((prev) =>
      prev.length >= 4 ? prev : [...prev, { cell_line: "", proportion: 0 }],
    );
  }
  function removeComponent(index: number) {
    setLiveComponents((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== index),
    );
  }
  function normalizeProportions() {
    setLiveComponents((prev) => {
      const total = prev.reduce((a, c) => a + (c.proportion || 0), 0);
      if (total <= 0) {
        const even = Number((1 / prev.length).toFixed(2));
        return prev.map((c) => ({ ...c, proportion: even }));
      }
      return prev.map((c) => ({
        ...c,
        proportion: Number((c.proportion / total).toFixed(2)),
      }));
    });
  }
  function toggleDrug(name: string) {
    setDrugPool((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name],
    );
  }

  function nearestCannedCase(): FolkloreCase | null {
    if (cases.length === 0) return null;
    const wanted = new Set(cellLines);
    let best = cases[0];
    let bestScore = -1;
    for (const entry of cases) {
      const overlap = entry.components.filter((c) =>
        wanted.has(c.cell_line),
      ).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        best = entry;
      }
    }
    return best;
  }

  async function handleRunLive() {
    if (!canRunLive) return;
    setRunning(true);
    setToast(null);
    try {
      const result = await runFolklore({
        tumor_name: "Live tumor",
        components: liveComponents.map((c) => ({
          cell_line: c.cell_line,
          proportion: c.proportion,
        })),
        budget: liveBudget,
        goal: liveGoal,
        policy: "active_learner",
        compare_policy: "random",
        drug_pool: drugPool.length > 0 ? drugPool : undefined,
      });
      setLiveCase(result);
      setPolicy("active_learner");
      setStep(1);
      setPlaying(false);
    } catch (err) {
      const fallback = nearestCannedCase();
      const msg = err instanceof Error ? err.message : "Live run failed.";
      if (fallback) {
        setMode("canned");
        setCaseId(fallback.id);
        setLiveCase(null);
        setStep(1);
        setPlaying(false);
        setToast(`${msg} Showing nearest canned demo: ${fallback.tumor_name}.`);
      } else {
        setToast(msg);
      }
    } finally {
      setRunning(false);
    }
  }

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
        <p>TINA is loading preset demos…</p>
        {loadError && <p className="max-w-md text-xs text-danger">{loadError}</p>}
      </div>
    );
  }

  return (
    <div className="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_14rem] gap-3 overflow-hidden p-3">
      {toast && (
        <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-xl border border-border-strong bg-surface-elevated px-4 py-2.5 text-sm text-fg shadow-[0_8px_24px_var(--shadow)]">
          {toast}
        </div>
      )}
      <div className="grid min-h-0 gap-3 xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
        <Card className="reveal flex min-h-0 flex-col gap-4 overflow-auto p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Tumor Intelligence &amp; Neoplastic Analysis</p>
              <h2 className="mt-1 font-display text-xl text-fg">{currentCase.tumor_name}</h2>
            </div>
            <div className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                  {mode === "canned" ? "Canned demo" : liveCase ? "Live result" : "Live run"}
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

          {mode === "canned" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="label-caps">Preset tumor</span>
                <select
                  value={presetCase?.id ?? ""}
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

              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-fg-muted transition hover:border-accent hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {regenerating
                  ? "Regenerating from simulator…"
                  : "Regenerate presets from simulator"}
              </button>

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
            </>
          ) : (
            <LiveEditor
              catalog={catalog}
              catalogError={catalogError}
              components={liveComponents}
              goal={liveGoal}
              budget={liveBudget}
              drugSearch={drugSearch}
              mechFilter={mechFilter}
              drugPool={drugPool}
              filteredDrugs={filteredDrugs}
              proportionSum={proportionSum}
              errors={liveErrors}
              canRun={canRunLive}
              running={running}
              onSetGoal={setLiveGoal}
              onSetBudget={setLiveBudget}
              onSetSearch={setDrugSearch}
              onSetMech={setMechFilter}
              onToggleDrug={toggleDrug}
              onClearPool={() => setDrugPool([])}
              onUpdateComponent={updateComponent}
              onAddComponent={addComponent}
              onRemoveComponent={removeComponent}
              onNormalize={normalizeProportions}
              onRun={handleRunLive}
            />
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

interface LiveEditorProps {
  catalog: FolkloreCatalog | null;
  catalogError: string | null;
  components: LiveComponentDraft[];
  goal: Goal;
  budget: number;
  drugSearch: string;
  mechFilter: string;
  drugPool: string[];
  filteredDrugs: FolkloreCatalog["drugs"];
  proportionSum: number;
  errors: string[];
  canRun: boolean;
  running: boolean;
  onSetGoal: (goal: Goal) => void;
  onSetBudget: (budget: number) => void;
  onSetSearch: (value: string) => void;
  onSetMech: (value: string) => void;
  onToggleDrug: (name: string) => void;
  onClearPool: () => void;
  onUpdateComponent: (index: number, patch: Partial<LiveComponentDraft>) => void;
  onAddComponent: () => void;
  onRemoveComponent: (index: number) => void;
  onNormalize: () => void;
  onRun: () => void;
}

function LiveEditor({
  catalog,
  catalogError,
  components,
  goal,
  budget,
  drugSearch,
  mechFilter,
  drugPool,
  filteredDrugs,
  proportionSum,
  errors,
  canRun,
  running,
  onSetGoal,
  onSetBudget,
  onSetSearch,
  onSetMech,
  onToggleDrug,
  onClearPool,
  onUpdateComponent,
  onAddComponent,
  onRemoveComponent,
  onNormalize,
  onRun,
}: LiveEditorProps) {
  const cellLineOptions = catalog?.cell_lines ?? [];
  const mechanisms = catalog?.mechanisms ?? [];
  const sumOk = Math.abs(proportionSum - 1) <= 0.01;

  return (
    <div className="flex flex-col gap-4">
      {catalogError && (
        <div className="rounded-xl border border-dashed border-border-strong bg-canvas-deep/60 p-3 text-xs text-fg-muted">
          Catalog unavailable: {catalogError} The picker fills once
          <span className="font-mono"> GET /folklore/catalog</span> is live. You
          can still run — invalid runs fall back to the nearest canned demo.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="label-caps">Tumor mixture</p>
          <button
            type="button"
            onClick={onAddComponent}
            disabled={components.length >= 4}
            className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"
          >
            + Subclone
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {components.map((component, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-surface-elevated p-3"
            >
              <div className="flex items-center gap-2">
                <select
                  value={component.cell_line}
                  onChange={(e) =>
                    onUpdateComponent(index, { cell_line: e.target.value })
                  }
                  className="input-base flex-1 px-2 py-1.5 text-sm"
                >
                  <option value="">Select cell line…</option>
                  {cellLineOptions.map((line) => (
                    <option key={line.cell_line} value={line.cell_line}>
                      {line.cell_line}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={component.proportion}
                  onChange={(e) =>
                    onUpdateComponent(index, {
                      proportion: Number(e.target.value),
                    })
                  }
                  className="input-base w-20 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onRemoveComponent(index)}
                  disabled={components.length <= 2}
                  className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                  aria-label="Remove subclone"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={sumOk ? "text-fg-muted" : "text-danger"}>
            Sum {proportionSum.toFixed(2)} / 1.00
          </span>
          <button
            type="button"
            onClick={onNormalize}
            className="btn-ghost px-2 py-1 text-xs"
          >
            Normalize
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Goal</span>
          <select
            value={goal}
            onChange={(e) => onSetGoal(e.target.value as Goal)}
            className="input-base px-2 py-1.5 text-sm"
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Budget · {budget}</span>
          <input
            type="range"
            min={6}
            max={10}
            step={1}
            value={budget}
            onChange={(e) => onSetBudget(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="label-caps">
            Drug pool {drugPool.length > 0 ? `· ${drugPool.length}` : "· full catalog"}
          </p>
          {drugPool.length > 0 && (
            <button
              type="button"
              onClick={onClearPool}
              className="btn-ghost px-2 py-1 text-xs"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={drugSearch}
            onChange={(e) => onSetSearch(e.target.value)}
            placeholder="Search compounds…"
            className="input-base flex-1 px-2 py-1.5 text-sm"
          />
          <select
            value={mechFilter}
            onChange={(e) => onSetMech(e.target.value)}
            className="input-base px-2 py-1.5 text-sm"
          >
            <option value="all">All mechanisms</option>
            {mechanisms.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-border bg-canvas/65 p-2">
          {filteredDrugs.length === 0 ? (
            <p className="px-1 py-2 text-xs text-fg-subtle">
              {catalog ? "No compounds match." : "Catalog not loaded."}
            </p>
          ) : (
            filteredDrugs.map((drug) => {
              const selected = drugPool.includes(drug.name);
              return (
                <button
                  key={drug.id}
                  type="button"
                  onClick={() => onToggleDrug(drug.name)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                    selected
                      ? "bg-accent/10 text-accent"
                      : "text-fg-muted hover:bg-surface-elevated"
                  }`}
                >
                  <span className="font-medium">{drug.name}</span>
                  <span className="text-fg-subtle">{drug.mechanism}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 text-xs text-danger">
          {errors.map((err) => (
            <li key={err}>• {err}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onRun}
        disabled={!canRun}
        className="btn-primary px-3 py-2.5 text-sm disabled:opacity-40"
      >
        {running ? "Running episode…" : "Run live screening"}
      </button>
    </div>
  );
}

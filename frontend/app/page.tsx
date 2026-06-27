"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import CoverageCurve from "@/components/CoverageCurve";
import RadarChart from "@/components/RadarChart";
import SelectionLog from "@/components/SelectionLog";
import Sidebar from "@/components/Sidebar";
import { getSelectedPanel, usePanelData } from "@/hooks/usePanelData";
import { computeCoverage, indicesFromLines } from "@/lib/coverage";
import { OMICS_LAYERS } from "@/lib/constants";
import type { PanelEntry } from "@/lib/types";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      Loading 3D scene…
    </div>
  ),
});

const CompareView = dynamic(() => import("@/components/CompareView"), {
  ssr: false,
});

type Tab = "explore" | "compare";

export default function Home() {
  const [tab, setTab] = useState<Tab>("explore");
  const [panelSize, setPanelSize] = useState(8);
  const [cancerType, setCancerType] = useState("all");
  const [activeLayers, setActiveLayers] = useState<string[]>([...OMICS_LAYERS]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualPanel, setManualPanel] = useState<string[]>([]);

  const { data, loading, error } = usePanelData(cancerType);

  const greedyEntries = useMemo(
    () => getSelectedPanel(data?.panels, panelSize),
    [data, panelSize],
  );
  const greedyLines = useMemo(
    () => greedyEntries.map((e) => e.cell_line),
    [greedyEntries],
  );

  const activeLines = isManualMode ? manualPanel : greedyLines;

  const manualCoverage = useMemo(() => {
    if (!isManualMode || !data?.embeddings.embeddings || manualPanel.length < 2) {
      return manualPanel.length > 0 ? 0.5 : 0;
    }
    const lineOrder = data.umap.map((p) => p.cell_line);
    const vectors = lineOrder.map((l) => data.embeddings.embeddings[l]);
    const indices = indicesFromLines(manualPanel, lineOrder);
    return computeCoverage(indices, vectors);
  }, [isManualMode, data, manualPanel]);

  const missingTypes = useMemo(
    () =>
      data?.blindspot?.by_panel_size[String(panelSize)]?.missing_types ?? [],
    [data, panelSize],
  );

  const displayEntries = useMemo((): PanelEntry[] => {
    if (!isManualMode) return greedyEntries;
    const lookup = new Map(data?.umap.map((p) => [p.cell_line, p]) ?? []);
    return manualPanel.map((cellLine, i) => ({
      cell_line: cellLine,
      cancer_type: lookup.get(cellLine)?.cancer_type ?? "Unknown",
      step: i + 1,
    }));
  }, [isManualMode, greedyEntries, manualPanel, data]);

  const handlePanelSizeChange = (size: number) => {
    setPanelSize(size);
    setIsManualMode(false);
    setManualPanel([]);
  };

  const handleSphereClick = useCallback(
    (cellLine: string) => {
      setIsManualMode(true);
      setManualPanel((prev) => {
        const base = prev.length > 0 ? prev : greedyLines;
        const next = new Set(base);
        if (next.has(cellLine)) next.delete(cellLine);
        else next.add(cellLine);
        return [...next];
      });
    },
    [greedyLines],
  );

  const resetToOptimal = () => {
    setIsManualMode(false);
    setManualPanel([]);
  };

  const toggleLayer = (layer: string) => {
    setActiveLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer],
    );
  };

  return (
    <div className="flex h-screen bg-[#050510] text-zinc-100">
      <div className="w-[25%] min-w-[280px] max-w-sm shrink-0">
        <Sidebar
          panelSize={panelSize}
          cancerType={cancerType}
          activeLayers={activeLayers}
          elbowSize={data?.coverage.elbow}
          loading={loading}
          isManualMode={isManualMode}
          manualCoverage={manualCoverage}
          blindspot={data?.blindspot}
          onPanelSizeChange={handlePanelSizeChange}
          onCancerTypeChange={setCancerType}
          onLayerToggle={toggleLayer}
          onResetToOptimal={resetToOptimal}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 gap-1 border-b border-white/10 px-4 pt-3">
          {(["explore", "compare"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t px-4 py-2 text-sm capitalize ${
                tab === t
                  ? "bg-[#0a0a18] text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
          {loading && (
            <span className="ml-auto self-center text-xs text-zinc-500">
              Loading data…
            </span>
          )}
          {error && (
            <span className="ml-auto self-center text-xs text-red-400">
              {error}
            </span>
          )}
        </div>

        {tab === "explore" ? (
          <>
            <div className="min-h-0 flex-1">
              {!loading && data && (
                <Scene3D
                  points={data.umap}
                  selectedLines={activeLines}
                  greedyLines={greedyLines}
                  isManualMode={isManualMode}
                  filterCancerType={cancerType === "all" ? undefined : cancerType}
                  missingTypes={missingTypes}
                  onSphereClick={handleSphereClick}
                />
              )}
              {loading && (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Loading UMAP embedding…
                </div>
              )}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-4 border-t border-white/10 p-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
                  Coverage vs panel size
                </p>
                <CoverageCurve
                  data={data?.coverage.curve}
                  currentPanelSize={panelSize}
                  elbowSize={data?.coverage.elbow}
                  manualDot={
                    isManualMode
                      ? {
                          panelSize: manualPanel.length,
                          coverage: manualCoverage,
                        }
                      : undefined
                  }
                />
              </div>
              <RadarChart perLayer={data?.perLayer} panelSize={panelSize} />
            </div>
            <div className="shrink-0 px-4 pb-4">
              <SelectionLog
                entries={displayEntries}
                characterization={data?.characterization}
              />
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1">
            <CompareView panelSize={panelSize} />
          </div>
        )}
      </main>
    </div>
  );
}

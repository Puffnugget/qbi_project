"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import CoverageCurve from "@/components/CoverageCurve";
import RadarChart from "@/components/RadarChart";
import SelectionLog from "@/components/SelectionLog";
import Sidebar from "@/components/Sidebar";
import { Tab, TabList, Tabs } from "@/components/ui/TabBar";
import { getSelectedPanel, usePanelData } from "@/hooks/usePanelData";
import { computeCoverage, indicesFromLines } from "@/lib/coverage";
import { OMICS_LAYERS } from "@/lib/constants";
import type { PanelEntry } from "@/lib/types";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-fg-muted">
      Loading 3D scene…
    </div>
  ),
});

const CompareView = dynamic(() => import("@/components/CompareView"), {
  ssr: false,
});

type TabId = "explore" | "compare" | "adaptive";

const AdaptiveDesignTab = dynamic(
  () => import("@/components/AdaptiveDesignTab"),
  { ssr: false },
);

const TAB_LABELS: Record<TabId, string> = {
  explore: "Explore",
  compare: "Compare",
  adaptive: "Adaptive design",
};

export default function Home() {
  const [tab, setTab] = useState<TabId>("explore");
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
    <div className="flex min-h-[100dvh] bg-canvas text-fg">
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

      <main className="flex min-w-0 flex-1 flex-col bg-canvas-deep/30">
        <Tabs value={tab} onChange={setTab}>
          <TabList>
            {(Object.keys(TAB_LABELS) as TabId[]).map((id) => (
              <Tab key={id} id={id} label={TAB_LABELS[id]} />
            ))}
            {loading && (
              <span className="ml-auto self-center text-xs text-fg-subtle">
                Loading data…
              </span>
            )}
            {error && (
              <span className="ml-auto self-center text-xs text-danger">
                {error}
              </span>
            )}
          </TabList>
        </Tabs>

        {tab === "explore" ? (
          <>
            <div className="reveal min-h-0 flex-1 p-3">
              {!loading && data && (
                <div className="h-full overflow-hidden rounded-xl border border-border shadow-[0_4px_24px_var(--shadow-strong)]">
                  <Scene3D
                    points={data.umap}
                    selectedLines={activeLines}
                    greedyLines={greedyLines}
                    isManualMode={isManualMode}
                    filterCancerType={cancerType === "all" ? undefined : cancerType}
                    missingTypes={missingTypes}
                    onSphereClick={handleSphereClick}
                  />
                </div>
              )}
              {loading && (
                <div className="flex h-full items-center justify-center text-sm text-fg-muted">
                  Loading UMAP embedding…
                </div>
              )}
            </div>
            <div
              className="reveal reveal-delay-1 grid shrink-0 grid-cols-2 gap-4 border-t border-border bg-surface/60 p-4"
            >
              <div>
                <p className="label-caps mb-2">Coverage vs panel size</p>
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
            <div className="reveal reveal-delay-2 shrink-0 px-4 pb-4">
              <SelectionLog
                entries={displayEntries}
                characterization={data?.characterization}
              />
            </div>
          </>
        ) : tab === "compare" ? (
          <div className="min-h-0 flex-1">
            <CompareView panelSize={panelSize} />
          </div>
        ) : (
            <div className="min-h-0 flex-1">
            <AdaptiveDesignTab umapPoints={data?.umap} adaptiveData={data?.adaptiveDesign} />
            </div>
        )}
      </main>
    </div>
  );
}

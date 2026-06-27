"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CANCER_TYPES } from "@/lib/constants";
import { getSelectedPanel, usePanelData } from "@/hooks/usePanelData";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      Loading scene…
    </div>
  ),
});

interface CompareViewProps {
  panelSize?: number;
}

export default function CompareView({ panelSize = 8 }: CompareViewProps) {
  const [typeA, setTypeA] = useState("Breast");
  const [typeB, setTypeB] = useState("Lung");

  const { data: dataA, loading: loadA } = usePanelData(typeA);
  const { data: dataB, loading: loadB } = usePanelData(typeB);

  const selectedA = useMemo(
    () => new Set(getSelectedPanel(dataA?.panels, panelSize).map((e) => e.cell_line)),
    [dataA, panelSize],
  );
  const selectedB = useMemo(
    () => new Set(getSelectedPanel(dataB?.panels, panelSize).map((e) => e.cell_line)),
    [dataB, panelSize],
  );

  const overlap = [...selectedA].filter((l) => selectedB.has(l));

  const cancerOptions = CANCER_TYPES.filter((t) => t !== "all");

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <select
            value={typeA}
            onChange={(e) => setTypeA(e.target.value)}
            className="rounded border border-white/10 bg-[#050510] px-2 py-1 text-zinc-200"
          >
            {cancerOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-zinc-500">vs</span>
          <select
            value={typeB}
            onChange={(e) => setTypeB(e.target.value)}
            className="rounded border border-white/10 bg-[#050510] px-2 py-1 text-zinc-200"
          >
            {cancerOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-zinc-400">
          Overlap:{" "}
          <span className="font-mono text-[#FFD700]">{overlap.length}</span>{" "}
          lines
          {overlap.length > 0 && (
            <span className="ml-2 text-xs text-zinc-500">
              ({overlap.join(", ")})
            </span>
          )}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="relative min-h-[300px] overflow-hidden rounded-lg border border-white/10">
          <p className="absolute left-3 top-3 z-10 text-xs text-zinc-500">{typeA}</p>
          {!loadA && dataA && (
            <Scene3D
              points={dataA.umap}
              selectedLines={[...selectedA]}
              filterCancerType={typeA}
              highlightOverlap={[...selectedA].filter((l) => selectedB.has(l))}
            />
          )}
        </div>
        <div className="relative min-h-[300px] overflow-hidden rounded-lg border border-white/10">
          <p className="absolute left-3 top-3 z-10 text-xs text-zinc-500">{typeB}</p>
          {!loadB && dataB && (
            <Scene3D
              points={dataB.umap}
              selectedLines={[...selectedB]}
              filterCancerType={typeB}
              highlightOverlap={[...selectedB].filter((l) => selectedA.has(l))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAppData, loadPanelForType } from "@/lib/data";
import type { AppData, PanelEntry } from "@/lib/types";

export function usePanelData(cancerType: string) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAppData(cancerType)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cancerType]);

  const refreshPanel = useCallback(async (type: string) => {
    const panels = await loadPanelForType(type);
    setData((prev) => (prev ? { ...prev, panels } : prev));
  }, []);

  return { data, loading, error, refreshPanel };
}

export function getSelectedPanel(
  panels: AppData["panels"] | undefined,
  panelSize: number,
): PanelEntry[] {
  if (!panels) return [];
  return panels.panels[String(panelSize)] ?? [];
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAppData, loadPanelForType } from "@/lib/data";
import type { AppData, PanelEntry } from "@/lib/types";

export function usePanelData(cancerType: string) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [prevCancerType, setPrevCancerType] = useState(cancerType);
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey);
  if (cancerType !== prevCancerType || reloadKey !== prevReloadKey) {
    setPrevCancerType(cancerType);
    setPrevReloadKey(reloadKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

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
  }, [cancerType, reloadKey]);

  const refreshPanel = useCallback(async (type: string) => {
    const panels = await loadPanelForType(type);
    setData((prev) => (prev ? { ...prev, panels } : prev));
  }, []);

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { data, loading, error, refreshPanel, retry };
}

export function getSelectedPanel(
  panels: AppData["panels"] | undefined,
  panelSize: number,
): PanelEntry[] {
  if (!panels) return [];
  return panels.panels[String(panelSize)] ?? [];
}

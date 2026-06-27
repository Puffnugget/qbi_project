import type {
  AppData,
  CharacterizationEntry,
  CoverageData,
  PanelData,
  PerLayerCoverage,
  UmapPoint,
} from "./types";

const BASE = "/precomputed";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function panelFile(cancerType: string): string {
  if (cancerType === "all") return "panel_all.json";
  return `panel_${cancerType.toLowerCase()}.json`;
}

export async function loadAppData(cancerType: string): Promise<AppData> {
  const [umapRaw, coverage, perLayer, panels, characterization] =
    await Promise.all([
      fetchJson<{ points: UmapPoint[] }>("umap_3d.json"),
      fetchJson<CoverageData>("coverage_curve.json"),
      fetchJson<PerLayerCoverage>("per_layer_coverage.json"),
      fetchJson<PanelData>(panelFile(cancerType)),
      fetchJson<Record<string, CharacterizationEntry>>(
        "characterization.json",
      ),
    ]);

  return {
    umap: umapRaw.points,
    coverage,
    perLayer,
    panels,
    characterization,
  };
}

export async function loadPanelForType(cancerType: string): Promise<PanelData> {
  return fetchJson<PanelData>(panelFile(cancerType));
}

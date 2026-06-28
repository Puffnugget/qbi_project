import type {
  AppData,
  FolkloreData,
  FolkloreCatalog,
  FolkloreRunRequest,
  FolkloreRunResponse,
  BlindspotData,
  CharacterizationEntry,
  AdaptiveDesignData,
  CoverageData,
  EmbeddingsData,
  PanelData,
  PerLayerCoverage,
  UmapPoint,
} from "./types";
import { API_BASE } from "./constants";

const BASE = "/precomputed";
const LAYER_LABELS: Record<string, string> = {
  rna: "RNA",
  prot: "Proteomics",
  methyl: "Methylation",
  histone: "Histone",
  drug: "Drug",
};

type RawPerLayerCoverage = Record<string, { panel_size: number; coverage: number }[]>;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function isAdaptiveDesignReady(
  data: AdaptiveDesignData | null | undefined,
): data is AdaptiveDesignData {
  return !!data && Object.keys(data.policies ?? {}).length > 0;
}

export function isFolkloreReady(
  data: FolkloreData | null | undefined,
): data is FolkloreData {
  return !!data && (data.preset_cases?.length ?? 0) > 0;
}

/** Adaptive design rollouts — proxied to FastAPI via Next.js /api rewrite. */
export async function fetchAdaptiveDesign(): Promise<AdaptiveDesignData> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/adaptive-design`);
  } catch {
    throw new Error(
      "Cannot reach the API. Run: ./scripts/run_api.sh",
    );
  }
  if (!res.ok) {
    throw new Error(
      `Folklore API unavailable (${res.status}). Run: ./scripts/run_api.sh`,
    );
  }
  return res.json() as Promise<AdaptiveDesignData>;
}

export async function fetchFolklore(): Promise<FolkloreData> {
  return fetchJson<FolkloreData>("folklore.json");
}

export function isFolkloreCatalogReady(
  catalog: FolkloreCatalog | null | undefined,
): catalog is FolkloreCatalog {
  return !!catalog && (catalog.drugs?.length ?? 0) > 0;
}

/** Live drug/cell-line catalog — backend GET /folklore/catalog. */
export async function fetchFolkloreCatalog(): Promise<FolkloreCatalog> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/folklore/catalog`);
  } catch {
    throw new Error("Cannot reach the catalog API. Run: ./scripts/run_api.sh");
  }
  if (!res.ok) {
    throw new Error(`Catalog unavailable (${res.status}).`);
  }
  return res.json() as Promise<FolkloreCatalog>;
}

/** Run one live screening episode — backend POST /folklore/run. */
export async function runFolklore(
  body: FolkloreRunRequest,
): Promise<FolkloreRunResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/folklore/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the run API. Run: ./scripts/run_api.sh");
  }
  if (!res.ok) {
    throw new Error(`Live run failed (${res.status}).`);
  }
  return res.json() as Promise<FolkloreRunResponse>;
}

function panelFile(cancerType: string): string {
  if (cancerType === "all") return "panel_all.json";
  return `panel_${cancerType.toLowerCase()}.json`;
}

export async function loadAppData(cancerType: string): Promise<AppData> {
  const [umapRaw, coverage, perLayer, panels, characterization, blindspot, embeddings, adaptiveDesign, folklore] =
    await Promise.all([
      fetchJson<{ points: UmapPoint[] } | UmapPoint[]>("umap_3d.json"),
      fetchJson<CoverageData>("coverage_curve.json"),
      fetchJson<RawPerLayerCoverage>("per_layer_coverage.json"),
      fetchJson<PanelData>(panelFile(cancerType)),
      fetchJson<Record<string, CharacterizationEntry>>(
        "characterization.json",
      ),
      fetchJson<BlindspotData>("blindspot.json").catch(() => ({
        by_panel_size: {},
      })),
      fetchJson<EmbeddingsData>("embeddings.json").catch(() => ({
        dimensions: 0,
        embeddings: {},
      })),
      fetchAdaptiveDesign().catch(() => ({
        target_size: 0,
        metric: "",
        n_cell_lines: 0,
        source: "dummy",
        policies: {},
      } as AdaptiveDesignData)),
      fetchFolklore().catch(() => ({
        source: "canned",
        preset_cases: [],
        available_policies: [],
      } as FolkloreData)),
    ]);

  const rawPoints = Array.isArray(umapRaw) ? umapRaw : umapRaw.points;
  const umap = rawPoints.map((p) => ({
    ...p,
    cell_line: p.cell_line ?? (p as UmapPoint & { id?: string }).id ?? "",
  }));
  const perLayerBySize: PerLayerCoverage = {};
  for (const [layer, rows] of Object.entries(perLayer)) {
    const label = LAYER_LABELS[layer] ?? layer;
    for (const row of rows) {
      const key = String(row.panel_size);
      perLayerBySize[key] = { ...perLayerBySize[key], [label]: row.coverage };
    }
  }

  return {
    umap,
    coverage,
    perLayer: perLayerBySize,
    panels,
    characterization,
    blindspot,
    embeddings,
    adaptiveDesign,
    folklore,
  };
}

export async function loadPanelForType(cancerType: string): Promise<PanelData> {
  return fetchJson<PanelData>(panelFile(cancerType));
}

export type CancerType = string;

export interface UmapPoint {
  cell_line: string;
  cancer_type: CancerType;
  x: number;
  y: number;
  z: number;
}

export interface PanelEntry {
  cell_line: string;
  cancer_type: CancerType;
  step: number;
}

export interface CoveragePoint {
  panel_size: number;
  coverage: number;
  validation_r?: number;
}

export interface CoverageData {
  elbow: number;
  curve: CoveragePoint[];
}

export interface PanelData {
  panels: Record<string, PanelEntry[]>;
}

export interface CharacterizationEntry {
  cancer_type: string;
  why_selected: string;
  top_genes: string[];
}

export interface PerLayerCoverage {
  [panelSize: string]: Record<string, number>;
}

export interface CancerTypeBlindspot {
  selected: number;
  total: number;
  fraction: number;
}

export interface PanelBlindspot {
  types: Record<string, CancerTypeBlindspot>;
  missing_types: string[];
}

export interface PathwayGap {
  pathway: string;
  global_mean: number;
  panel_mean: number;
  gap: number;
}

export interface BlindspotData {
  by_panel_size: Record<string, PanelBlindspot>;
  pathway_gaps_by_size?: Record<string, PathwayGap[]>;
}

export interface EmbeddingsData {
  dimensions: number;
  embeddings: Record<string, number[]>;
}

export interface AdaptiveStep {
  step: number;
  cell_line: string;
  median_r: number;
}

export interface AdaptivePolicyRollout {
  policy: string;
  selections: string[];
  curve: AdaptiveStep[];
  final_median_r: number;
}

export interface AdaptiveDesignData {
  target_size: number;
  metric: string;
  n_cell_lines: number;
  source?: "real" | "dummy";
  policies: Record<string, AdaptivePolicyRollout>;
}

export interface AppData {
  umap: UmapPoint[];
  coverage: CoverageData;
  perLayer: PerLayerCoverage;
  panels: PanelData;
  characterization: Record<string, CharacterizationEntry>;
  blindspot: BlindspotData;
  embeddings: EmbeddingsData;
}

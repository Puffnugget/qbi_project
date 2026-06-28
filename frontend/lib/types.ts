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

export interface FolkloreTumorComponent {
  cell_line: string;
  proportion: number;
  cancer_type?: CancerType;
}

export interface FolkloreSubcloneResponse {
  cell_line: string;
  response: number;
  label: "sensitive" | "intermediate" | "resistant";
}

export interface FolkloreStep {
  step: number;
  compound: string;
  mechanism: string;
  chosen_by: string;
  mixed_response: number;
  subclone_responses: FolkloreSubcloneResponse[];
  why_chosen: string;
  best_response_so_far: number;
}

export interface FolkloreFinalRecommendation {
  recommended_compound: string;
  main_realization: string;
  next_experiment: string;
  active_vs_random: string;
}

export interface FolklorePolicySummaryPoint {
  step: number;
  score: number;
}

export interface FolklorePolicyRun {
  policy: string;
  steps: FolkloreStep[];
  final: FolkloreFinalRecommendation;
  summary_curve: FolklorePolicySummaryPoint[];
}

export interface FolkloreCase {
  id: string;
  tumor_name: string;
  hook: string;
  goal: "find responder" | "find resistance" | "find robust drug";
  budget: number;
  components: FolkloreTumorComponent[];
  policies: Record<string, FolklorePolicyRun>;
}

export interface FolkloreData {
  source: "canned" | "live";
  preset_cases: FolkloreCase[];
  available_policies: string[];
}

export interface FolkloreCatalogDrug {
  id: string;
  name: string;
  mechanism: string;
  n_cell_lines?: number;
}

export interface FolkloreCatalogCellLine {
  cell_line: string;
  cancer_type?: CancerType;
}

export interface FolkloreCatalog {
  cell_lines: FolkloreCatalogCellLine[];
  drugs: FolkloreCatalogDrug[];
  mechanisms: string[];
  available_policies: string[];
  goals: FolkloreCase["goal"][];
}

export interface FolkloreRunRequest {
  tumor_name: string;
  components: { cell_line: string; proportion: number }[];
  budget: number;
  goal: FolkloreCase["goal"];
  policy: string;
  compare_policy?: string;
  drug_pool?: string[];
}

/** A live run returns a single case with the chosen + comparison policies. */
export type FolkloreRunResponse = FolkloreCase;

export interface AppData {
  umap: UmapPoint[];
  coverage: CoverageData;
  perLayer: PerLayerCoverage;
  panels: PanelData;
  characterization: Record<string, CharacterizationEntry>;
  blindspot: BlindspotData;
  embeddings: EmbeddingsData;
  adaptiveDesign: AdaptiveDesignData;
  folklore?: FolkloreData;
}

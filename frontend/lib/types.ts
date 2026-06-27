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

export interface AppData {
  umap: UmapPoint[];
  coverage: CoverageData;
  perLayer: PerLayerCoverage;
  panels: PanelData;
  characterization: Record<string, CharacterizationEntry>;
}

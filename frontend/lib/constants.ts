export const CANCER_COLORS: Record<string, string> = {
  Breast: "#FF6B9D",
  CNS: "#C77DFF",
  Colon: "#4CC9F0",
  Leukemia: "#F72585",
  Lung: "#4361EE",
  Melanoma: "#F77F00",
  Ovarian: "#FCBF49",
  Prostate: "#06D6A0",
  Renal: "#EF233C",
};

export const CANCER_TYPES = [
  "all",
  "Breast",
  "CNS",
  "Colon",
  "Leukemia",
  "Lung",
  "Melanoma",
  "Ovarian",
  "Prostate",
  "Renal",
] as const;

export const OMICS_LAYERS = [
  "RNA",
  "Proteomics",
  "Metabolomics",
  "Drug",
] as const;

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Earth-tone cancer type colors — harmonized with beige + forest green UI. */
export const CANCER_COLORS: Record<string, string> = {
  Breast: "#C65D7A",
  CNS: "#7B6B9E",
  Colon: "#3D8B7A",
  Leukemia: "#B54A6B",
  Lung: "#4A7C59",
  Melanoma: "#C4843A",
  Ovarian: "#D4A843",
  Prostate: "#2D7A6E",
  Renal: "#A34444",
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
  "Methylation",
  "Histone",
  "Drug",
] as const;

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api";

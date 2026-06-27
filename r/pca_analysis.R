library(tidyverse)

N_COMPONENTS <- 30
CLEAN_DIR    <- "processed_data/clean"
OUT_DIR      <- "processed_data/pca"
dir.create(OUT_DIR, recursive = TRUE, showWarnings = FALSE)

run_pca <- function(file_path, out_name, n_components = N_COMPONENTS) {
  mat <- read_csv(file_path, show_col_types = FALSE, na = c("", "NA", "na", "-"))

  cell_lines <- mat[[1]]
  feat_names <- colnames(mat)[-1]
  feat_mat   <- as.matrix(mat[, -1])

  # drop features with zero variance
  keep <- apply(feat_mat, 2, var, na.rm = TRUE) > 0
  feat_mat <- feat_mat[, keep]
  feat_names <- feat_names[keep]

  # impute remaining NAs with column mean
  col_means <- colMeans(feat_mat, na.rm = TRUE)
  for (j in seq_len(ncol(feat_mat))) {
    na_idx <- is.na(feat_mat[, j])
    if (any(na_idx)) feat_mat[na_idx, j] <- col_means[j]
  }

  pca      <- prcomp(feat_mat, center = TRUE, scale. = TRUE)
  n_keep   <- min(n_components, ncol(pca$x))
  scores   <- as.data.frame(pca$x[, seq_len(n_keep)])
  colnames(scores) <- paste0("PC", seq_len(n_keep))

  # Save scores
  out      <- cbind(cell_line = cell_lines, scores)
  out_path <- file.path(OUT_DIR, out_name)
  write_csv(out, out_path)

  # Save loadings
  loadings <- as.data.frame(pca$rotation[, seq_len(n_keep)])
  colnames(loadings) <- paste0("PC", seq_len(n_keep))
  loadings <- cbind(feature = feat_names, loadings)
  loadings_path <- file.path(OUT_DIR, sub("\\.csv$", "_loadings.csv", out_name))
  write_csv(loadings, loadings_path)

  var_exp  <- round(summary(pca)$importance[2, seq_len(n_keep)] * 100, 2)
  cat(sprintf(
    "%-40s | %d PCs | %.1f%% variance explained\n",
    basename(file_path), n_keep, sum(var_exp)
  ))
}

datasets <- list(
  list(file = file.path(CLEAN_DIR, "proteomics_clean.csv"),                         out = "proteomics_pca.csv"),
  list(file = file.path(CLEAN_DIR, "rna_seq_clean.csv"),                            out = "rna_seq_pca.csv"),
  list(file = file.path(CLEAN_DIR, "methylation_clean.csv"),                        out = "methylation_pca.csv"),
  list(file = file.path(CLEAN_DIR, "histone_clean.csv"),                            out = "histone_pca.csv"),
  list(file = file.path(CLEAN_DIR, "drug_landmarks/drug_activity_landmark_matrix.csv"), out = "drug_activity_pca.csv")
)

for (ds in datasets) run_pca(ds$file, ds$out)

cat("\nPCA complete. Files written to", OUT_DIR, "\n")

# --- Fused matrix -----------------------------------------------------------
# Load each PCA result, prefix PC columns with layer name, then inner-join on
# cell_line so only lines present in all layers are kept.

layers <- list(
  rna      = "rna_seq_pca.csv",
  prot     = "proteomics_pca.csv",
  methyl   = "methylation_pca.csv",
  histone  = "histone_pca.csv",
  drug     = "drug_activity_pca.csv"
)

pca_tables <- lapply(names(layers), function(prefix) {
  df <- read_csv(file.path(OUT_DIR, layers[[prefix]]), show_col_types = FALSE)
  colnames(df)[-1] <- paste0(prefix, "_", colnames(df)[-1])
  df
})

fused <- Reduce(function(a, b) inner_join(a, b, by = "cell_line"), pca_tables)

fused_path <- file.path(OUT_DIR, "fused_matrix.csv")
write_csv(fused, fused_path)

cat(sprintf(
  "Fused matrix: %d cell lines x %d features → %s\n",
  nrow(fused), ncol(fused) - 1, fused_path
))

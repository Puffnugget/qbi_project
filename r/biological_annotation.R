library(tidyverse)

OUT_DIR <- "processed_data/annotation"
dir.create(OUT_DIR, recursive = TRUE, showWarnings = FALSE)

# --- RNA-Seq: Top genes --------------------------------

rna_loadings <- read_csv("processed_data/pca/rna_seq_pca_loadings.csv", show_col_types = FALSE)

rna_annotations <- list()

for (pc in c("PC1", "PC2", "PC3")) {
  loadings_vec <- rna_loadings[[pc]]
  names(loadings_vec) <- rna_loadings$feature

  top_idx <- order(abs(loadings_vec), decreasing = TRUE)[1:50]
  top_genes <- names(loadings_vec)[top_idx]

  top_genes_data <- tibble(
    gene = top_genes,
    loading = loadings_vec[top_genes],
    abs_loading = abs(loadings_vec[top_genes])
  ) %>% arrange(desc(abs_loading))

  top_3 <- paste(head(top_genes_data$gene, 3), collapse = ", ")
  rna_annotations[[pc]] <- list(top_genes = top_genes_data)

  cat(sprintf("RNA %s: %s\n", pc, top_3))
}

# --- Proteomics: Top proteins -----------------------------------------------

prot_loadings <- read_csv("processed_data/pca/proteomics_pca_loadings.csv", show_col_types = FALSE)

prot_annotations <- list()

for (pc in c("PC1", "PC2", "PC3")) {
  loadings_vec <- prot_loadings[[pc]]
  names(loadings_vec) <- prot_loadings$feature

  top_idx <- order(abs(loadings_vec), decreasing = TRUE)[1:20]
  top_proteins <- names(loadings_vec)[top_idx]

  prot_annotations[[pc]] <- tibble(
    protein = top_proteins,
    loading = loadings_vec[top_proteins],
    abs_loading = abs(loadings_vec[top_proteins])
  ) %>% arrange(desc(abs_loading))

  cat(sprintf("Proteomics %s: %s\n", pc,
              paste(head(top_proteins, 3), collapse = ", ")))
}

# --- Methylation: Top features -----------------------------------------------

methyl_loadings <- read_csv("processed_data/pca/methylation_pca_loadings.csv", show_col_types = FALSE)

methyl_annotations <- list()

for (pc in c("PC1", "PC2", "PC3")) {
  loadings_vec <- methyl_loadings[[pc]]
  names(loadings_vec) <- methyl_loadings$feature

  top_idx <- order(abs(loadings_vec), decreasing = TRUE)[1:20]
  top_methyl <- names(loadings_vec)[top_idx]

  methyl_annotations[[pc]] <- tibble(
    feature = top_methyl,
    loading = loadings_vec[top_methyl],
    abs_loading = abs(loadings_vec[top_methyl])
  ) %>% arrange(desc(abs_loading))

  cat(sprintf("Methylation %s: %s\n", pc,
              paste(head(top_methyl, 3), collapse = ", ")))
}

# --- Save outputs -----------------------------------------------------------

# Top genes for each PC
for (pc in c("PC1", "PC2", "PC3")) {
  genes_df <- rna_annotations[[pc]]$top_genes %>%
    select(gene, loading) %>%
    arrange(desc(abs(loading)))
  write_csv(genes_df, file.path(OUT_DIR, sprintf("rna_%s_top_genes.csv", pc)))
}

# Top proteins for each PC
for (pc in c("PC1", "PC2", "PC3")) {
  write_csv(prot_annotations[[pc]],
            file.path(OUT_DIR, sprintf("proteomics_%s_top_proteins.csv", pc)))
}

# Top methylation features for each PC
for (pc in c("PC1", "PC2", "PC3")) {
  write_csv(methyl_annotations[[pc]],
            file.path(OUT_DIR, sprintf("methylation_%s_top_features.csv", pc)))
}

cat(sprintf("\n✓ Biological annotations saved to %s\n", OUT_DIR))

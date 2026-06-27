library(data.table)

input_dir <- file.path("processed_data", "filtered")
output_dir <- file.path("processed_data", "zscored")
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

files <- list(
  rna_seq = list(
    input = file.path(input_dir, "rna_seq_filtered.csv"),
    output = file.path(output_dir, "rna_seq_filtered.csv"),
    zscore = FALSE
  ),
  methylation = list(
    input = file.path(input_dir, "methylation_filtered.csv"),
    output = file.path(output_dir, "methylation_zscored.csv"),
    zscore = TRUE
  ),
  proteomics = list(
    input = file.path(input_dir, "proteomics_filtered.csv"),
    output = file.path(output_dir, "proteomics_zscored.csv"),
    zscore = TRUE
  ),
  histone = list(
    input = file.path(input_dir, "histone_filtered.csv"),
    output = file.path(output_dir, "histone_filtered.csv"),
    zscore = FALSE
  ),
  drug_activity = list(
    input = file.path(input_dir, "drug_activity_filtered.csv"),
    output = file.path(output_dir, "drug_activity_filtered.csv"),
    zscore = FALSE
  )
)

zscore_columns <- function(mat) {
  feature_means <- colMeans(mat, na.rm = TRUE)
  feature_sds <- apply(mat, 2, sd, na.rm = TRUE)
  constant_or_missing <- !is.finite(feature_sds) | feature_sds == 0
  feature_sds[constant_or_missing] <- 1

  z <- sweep(mat, 2, feature_means, "-")
  z <- sweep(z, 2, feature_sds, "/")
  z[, constant_or_missing] <- 0
  z
}

summarize_numeric <- function(mat) {
  feature_means <- colMeans(mat, na.rm = TRUE)
  feature_sds <- apply(mat, 2, sd, na.rm = TRUE)

  list(
    median_abs_mean = median(abs(feature_means), na.rm = TRUE),
    median_sd = median(feature_sds, na.rm = TRUE),
    missing = sum(is.na(mat))
  )
}

for (name in names(files)) {
  spec <- files[[name]]
  dt <- fread(spec$input, na.strings = c("", "NA", "na"), showProgress = FALSE)

  if (spec$zscore) {
    cell_lines <- dt[[1]]
    mat <- as.matrix(dt[, -1, with = FALSE])
    suppressWarnings(storage.mode(mat) <- "numeric")

    before <- summarize_numeric(mat)
    mat <- zscore_columns(mat)
    after <- summarize_numeric(mat)

    output <- data.table(cell_line = cell_lines)
    output <- cbind(output, as.data.table(mat))
    setnames(output, names(dt))
    fwrite(output, spec$output, na = "")

    cat(name, "z-scored ->", spec$output, "\n")
    cat("  before median_abs_mean=", before$median_abs_mean,
        " median_sd=", before$median_sd,
        " missing=", before$missing, "\n", sep = "")
    cat("  after  median_abs_mean=", after$median_abs_mean,
        " median_sd=", after$median_sd,
        " missing=", after$missing, "\n", sep = "")
  } else {
    fwrite(dt, spec$output, na = "")
    cat(name, "copied unchanged ->", spec$output, "\n")
  }
}

library(data.table)

input_dir <- file.path("processed_data", "filtered")
output_dir <- file.path("processed_data", "log_zscored")
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

files <- list(
  rna = list(
    input = file.path(input_dir, "rna_seq_filtered.csv"),
    output = file.path(output_dir, "rna_seq_log_zscored.csv")
  ),
  methylation = list(
    input = file.path(input_dir, "methylation_filtered.csv"),
    output = file.path(output_dir, "methylation_log_zscored.csv")
  ),
  proteomics = list(
    input = file.path(input_dir, "proteomics_filtered.csv"),
    output = file.path(output_dir, "proteomics_log_zscored.csv")
  ),
  histone = list(
    input = file.path(input_dir, "histone_filtered.csv"),
    output = file.path(output_dir, "histone_log_zscored.csv")
  ),
  drug = list(
    input = file.path(input_dir, "drug_activity_filtered.csv"),
    output = file.path(output_dir, "drug_activity_log_zscored.csv")
  )
)

as_numeric_matrix <- function(dt) {
  mat <- as.matrix(dt[, -1, with = FALSE])
  suppressWarnings(storage.mode(mat) <- "numeric")
  mat
}

is_log_transformed <- function(mat) {
  values <- mat[is.finite(mat)]

  if (length(values) == 0) {
    return(FALSE)
  }

  # Negative values cannot come from unlogged count/intensity data, so treat them
  # as already log-scale or transformed values.
  any(values < 0) || max(values, na.rm = TRUE) <= 50
}

is_z_scored <- function(mat, mean_tol = 0.1, sd_tol = 0.1) {
  feature_means <- colMeans(mat, na.rm = TRUE)
  feature_sds <- apply(mat, 2, sd, na.rm = TRUE)
  usable <- is.finite(feature_means) & is.finite(feature_sds) & feature_sds > 0

  if (!any(usable)) {
    return(FALSE)
  }

  median(abs(feature_means[usable]), na.rm = TRUE) <= mean_tol &&
    median(abs(feature_sds[usable] - 1), na.rm = TRUE) <= sd_tol
}

z_score_columns <- function(mat) {
  feature_means <- colMeans(mat, na.rm = TRUE)
  feature_sds <- apply(mat, 2, sd, na.rm = TRUE)
  zero_or_missing_sd <- !is.finite(feature_sds) | feature_sds == 0
  feature_sds[zero_or_missing_sd] <- 1

  scaled <- sweep(mat, 2, feature_means, "-")
  scaled <- sweep(scaled, 2, feature_sds, "/")
  scaled[, zero_or_missing_sd] <- 0
  scaled
}

summarize_matrix <- function(mat) {
  values <- mat[is.finite(mat)]
  feature_means <- colMeans(mat, na.rm = TRUE)
  feature_sds <- apply(mat, 2, sd, na.rm = TRUE)

  list(
    min = min(values, na.rm = TRUE),
    max = max(values, na.rm = TRUE),
    median_abs_mean = median(abs(feature_means), na.rm = TRUE),
    median_sd = median(feature_sds, na.rm = TRUE),
    missing = sum(is.na(mat))
  )
}

for (name in names(files)) {
  spec <- files[[name]]
  dt <- fread(spec$input, na.strings = c("", "NA", "na"), showProgress = FALSE)
  cell_lines <- dt[[1]]
  mat <- as_numeric_matrix(dt)

  before <- summarize_matrix(mat)
  log_transformed <- is_log_transformed(mat)
  z_scored <- is_z_scored(mat)

  if (!log_transformed) {
    finite_values <- mat[is.finite(mat)]

    if (any(finite_values < 0)) {
      warning(name, ": skipped log2 transform because negative values are present.")
    } else {
      mat <- log2(mat + 1)
      log_transformed <- TRUE
    }
  }

  if (!z_scored) {
    mat <- z_score_columns(mat)
    z_scored <- TRUE
  }

  output <- data.table(cell_line = cell_lines)
  output <- cbind(output, as.data.table(mat))
  setnames(output, names(dt))
  fwrite(output, spec$output, na = "")

  after <- summarize_matrix(mat)

  cat(name, "\n")
  cat("  input:", spec$input, "\n")
  cat("  output:", spec$output, "\n")
  cat("  dimensions:", nrow(mat), "cell lines x", ncol(mat), "features\n")
  cat("  before: min=", before$min, " max=", before$max,
      " median_abs_mean=", before$median_abs_mean,
      " median_sd=", before$median_sd,
      " missing=", before$missing, "\n", sep = "")
  cat("  already_log_transformed:", log_transformed, "\n")
  cat("  already_z_scored_before_processing:", is_z_scored(as_numeric_matrix(dt)), "\n")
  cat("  after: min=", after$min, " max=", after$max,
      " median_abs_mean=", after$median_abs_mean,
      " median_sd=", after$median_sd,
      " missing=", after$missing, "\n\n", sep = "")
}

library(readxl)

raw_dir <- "raw_data"
output_dir <- file.path(raw_dir, "transposed")
filtered_dir <- file.path(raw_dir, "filtered")
dir.create(output_dir, showWarnings = FALSE)
dir.create(filtered_dir, showWarnings = FALSE)

file_specs <- list(
  list(
    input = file.path(raw_dir, "rna_seq.xls"),
    output = file.path(output_dir, "rna_seq_transposed.csv"),
    filtered_output = file.path(filtered_dir, "rna_seq_filtered.csv"),
    sheet = 1,
    skip = 10
  ),
  list(
    input = file.path(raw_dir, "methylation.xls"),
    output = file.path(output_dir, "methylation_transposed.csv"),
    filtered_output = file.path(filtered_dir, "methylation_filtered.csv"),
    sheet = 1,
    skip = 10
  ),
  list(
    input = file.path(raw_dir, "proteomics.xls"),
    output = file.path(output_dir, "proteomics_transposed.csv"),
    filtered_output = file.path(filtered_dir, "proteomics_filtered.csv"),
    sheet = 1,
    skip = 10
  ),
  list(
    input = file.path(raw_dir, "histone.xlsx"),
    output = file.path(output_dir, "histone_transposed.csv"),
    filtered_output = file.path(filtered_dir, "histone_filtered.csv"),
    sheet = 1,
    skip = 8
  ),
  list(
    input = file.path(raw_dir, "drug_activity.xlsx"),
    output = file.path(output_dir, "drug_activity_transposed.csv"),
    filtered_output = file.path(filtered_dir, "drug_activity_filtered.csv"),
    sheet = 1,
    skip = 8
  )
)

is_cell_line <- function(x) {
  grepl("^[A-Z]{2,3}:", x)
}

find_cell_line_start <- function(header_row) {
  normalized <- trimws(as.character(header_row))
  hits <- which(is_cell_line(normalized))

  if (length(hits) == 0) {
    stop("Could not find a cell line header column.")
  }

  hits[1]
}

transpose_sheet <- function(path, output_path, sheet, skip, start_col = NULL) {
  raw <- read_excel(
    path,
    sheet = sheet,
    skip = skip,
    col_names = FALSE,
    .name_repair = "minimal"
  )

  if (is.null(start_col)) {
    start_col <- find_cell_line_start(raw[1, ])
  }
  trimmed <- raw[, start_col:ncol(raw), drop = FALSE]
  transposed <- as.data.frame(t(as.matrix(trimmed)), stringsAsFactors = FALSE)

  names(transposed)[1] <- "cell_line"
  transposed$cell_line <- trimws(as.character(transposed$cell_line))
  rownames(transposed) <- NULL

  transposed
}

transposed_data <- vector("list", length(file_specs))
names(transposed_data) <- vapply(file_specs, function(spec) basename(spec$input), character(1))

for (spec in file_specs) {
  start_col <- if ("start_col" %in% names(spec)) spec$start_col else NULL

  transposed_data[[basename(spec$input)]] <- transpose_sheet(
    path = spec$input,
    output_path = spec$output,
    sheet = spec$sheet,
    skip = spec$skip,
    start_col = start_col
  )
}

for (spec in file_specs) {
  dataset_name <- basename(spec$input)
  write.csv(transposed_data[[dataset_name]], spec$output, row.names = FALSE, na = "")

  message(
    dataset_name,
    ": wrote unfiltered transposed data with ",
    nrow(transposed_data[[dataset_name]]),
    " rows to ",
    spec$output
  )
}

common_cell_lines <- Reduce(
  intersect,
  lapply(transposed_data, function(df) df$cell_line[is_cell_line(df$cell_line)])
)

common_cell_lines <- transposed_data[[1]]$cell_line[
  transposed_data[[1]]$cell_line %in% common_cell_lines
]

for (spec in file_specs) {
  dataset_name <- basename(spec$input)
  filtered <- transposed_data[[dataset_name]]
  filtered <- filtered[filtered$cell_line %in% common_cell_lines, , drop = FALSE]
  filtered <- filtered[match(common_cell_lines, filtered$cell_line), , drop = FALSE]
  rownames(filtered) <- NULL

  write.csv(filtered, spec$filtered_output, row.names = FALSE, na = "")

  message(
    dataset_name,
    ": wrote ",
    nrow(filtered),
    " common cell lines to ",
    spec$filtered_output
  )
}

message("Common cell lines across all datasets: ", length(common_cell_lines))

cat("Common lines found:", length(common_lines), "\n")
cat("First 10 lines:\n")
print(head(common_lines, 10))
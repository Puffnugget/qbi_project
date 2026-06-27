library(data.table)
library(readxl)

target_n <- 150
max_missing_rate <- 0.20

input_matrix <- file.path("processed_data", "clean", "drug_activity_clean.csv")
raw_drug_file <- file.path("raw_data", "drug_activity.xlsx")
output_dir <- file.path("processed_data", "clean")
output_matrix <- file.path(output_dir, "drug_activity_landmark_clean.csv")
output_metadata <- file.path(output_dir, "drug_activity_landmark_metadata.csv")

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

clean_feature_name <- function(nsc, drug_name) {
  label <- paste("NSC", nsc, drug_name, sep = "_")
  label <- gsub("[^A-Za-z0-9]+", "_", label)
  label <- gsub("^_+|_+$", "", label)
  label
}

drug_category <- function(mechanism, drug_name) {
  text <- toupper(paste(mechanism, drug_name, sep = " "))

  if (grepl("PK:", text)) {
    return("kinase_inhibitor")
  }
  if (grepl("TOP1|TOP2|ALKAG|\\bA7\\b|\\bDS\\b|\\bDB\\b|\\bDF\\b|PLATIN|CISPLATIN|CARBOPLATIN|DOXORUBICIN|DAUNORUBICIN|ETOPOSIDE", text)) {
    return("dna_damaging")
  }
  if (grepl("METHOTREXATE|FLUOROURACIL|5-FU|CYTARABINE|GEMCITABINE|PEMETREXED|HYDROXYUREA|ANTIMETAB", text)) {
    return("antimetabolite")
  }
  if (grepl("HDAC|HSP90|BRD|MDM2|IAP|PSM|DNMT|PARP|MTOR|BCL|MCL1|AROMATASE|PROTEASOME", text)) {
    return("targeted_agent")
  }

  "other_annotated"
}

round_robin_select <- function(candidates, target_n) {
  candidates <- candidates[
    order(mechanism, missing_rate, -fda_approved, drug_name)
  ]
  by_mechanism <- split(candidates, candidates$mechanism, drop = TRUE)
  mechanism_order <- names(sort(table(candidates$mechanism), decreasing = TRUE))

  selected <- list()
  selected_count <- 0
  position <- 1

  while (selected_count < target_n) {
    added_this_round <- FALSE

    for (mechanism in mechanism_order) {
      mechanism_candidates <- by_mechanism[[mechanism]]

      if (position <= nrow(mechanism_candidates)) {
        selected_count <- selected_count + 1
        selected[[selected_count]] <- mechanism_candidates[position]
        added_this_round <- TRUE
      }

      if (selected_count == target_n) {
        break
      }
    }

    if (!added_this_round) {
      break
    }

    position <- position + 1
  }

  rbindlist(selected)
}

drug_matrix <- fread(
  input_matrix,
  na.strings = c("", "NA", "na"),
  showProgress = FALSE
)

values <- as.matrix(drug_matrix[, -1, with = FALSE])
suppressWarnings(storage.mode(values) <- "numeric")
missing_rate <- colMeans(is.na(values))

raw_drugs <- read_excel(
  raw_drug_file,
  sheet = 1,
  skip = 8,
  col_names = FALSE,
  .name_repair = "minimal"
)

metadata <- as.data.table(raw_drugs[-1, 1:6])
setnames(metadata, c("nsc", "drug_name", "fda_status", "mechanism", "pubchem", "smiles"))

metadata[, source_column := paste0("V", .I + 1)]
metadata[, missing_rate := missing_rate[source_column]]
metadata[, `:=`(
  nsc = trimws(as.character(nsc)),
  drug_name = trimws(as.character(drug_name)),
  fda_status = trimws(as.character(fda_status)),
  mechanism = trimws(as.character(mechanism)),
  pubchem = trimws(as.character(pubchem)),
  smiles = trimws(as.character(smiles))
)]
metadata[, fda_approved := !(is.na(fda_status) | fda_status == "" | fda_status == "-")]
metadata[, has_mechanism := !(is.na(mechanism) | mechanism == "" | mechanism == "-" | mechanism == "PK:Not Available")]
metadata[, category := mapply(drug_category, mechanism, drug_name)]

eligible <- metadata[
  missing_rate <= max_missing_rate &
    has_mechanism == TRUE &
    !is.na(drug_name) &
    drug_name != "" &
    drug_name != "-"
]

selected <- round_robin_select(eligible, min(target_n, nrow(eligible)))
selected[, clean_feature_name := make.unique(clean_feature_name(nsc, drug_name), sep = "_")]

selected_columns <- selected$source_column
landmark_matrix <- drug_matrix[, c("cell_line", selected_columns), with = FALSE]
setnames(landmark_matrix, c("cell_line", selected$clean_feature_name))

fwrite(landmark_matrix, output_matrix, na = "")
fwrite(selected, output_metadata, na = "")

cat("Drug landmark filtering complete\n")
cat("Input drugs:", ncol(drug_matrix) - 1, "\n")
cat("Eligible drugs after <=", max_missing_rate * 100, "% missing and mechanism annotation:", nrow(eligible), "\n", sep = "")
cat("Selected landmark drugs:", nrow(selected), "\n")
cat("Output matrix:", output_matrix, "\n")
cat("Output metadata:", output_metadata, "\n")
cat("\nSelected mechanism categories:\n")
print(selected[, .N, by = category][order(-N)])
cat("\nTop selected mechanisms:\n")
print(head(selected[, .N, by = mechanism][order(-N)], 25))

# Folklore Train/Val Split

The ensemble uses rows from `processed_data/folklore/train_features.parquet`.
Each row is one observed `cell_line` x `drug` response.

Split rule: hold out whole cell lines, not individual drug rows. The training
script shuffles unique `cell_line` values with `--seed` and reserves 20% of
cell lines for validation. This prevents the same tumor line from appearing in
both train and validation through different drugs.

Features intentionally exclude `drug_PC*` from `fused_matrix.csv` because those
PCs are derived from the response matrix. Inputs are cell-line omics PCs plus
drug metadata one-hots. The simulator still uses the landmark matrix for live
step outcomes; the ensemble only scores which drug to test next.

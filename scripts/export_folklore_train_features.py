"""Export tabular Folklore train rows for the RunPod ensemble."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FUSED = ROOT / "processed_data" / "pca" / "fused_matrix.csv"
MATRIX = ROOT / "processed_data" / "clean" / "drug_landmarks" / "drug_activity_landmark_matrix.csv"
META = ROOT / "processed_data" / "clean" / "drug_landmarks" / "drug_activity_landmark_metadata.csv"
OUT = ROOT / "processed_data" / "folklore" / "train_features.parquet"


def build_features() -> pd.DataFrame:
    fused = pd.read_csv(FUSED)
    matrix = pd.read_csv(MATRIX)
    meta = pd.read_csv(META)

    omics_cols = [c for c in fused.columns if c != "cell_line" and not c.startswith("drug_PC")]
    drug_meta = pd.get_dummies(
        meta[["clean_feature_name", "mechanism", "category", "fda_approved"]]
        .rename(columns={"clean_feature_name": "drug"})
        .fillna({"mechanism": "unknown", "category": "unknown", "fda_approved": False}),
        columns=["mechanism", "category"],
        dtype=float,
    )
    drug_meta["fda_approved"] = drug_meta["fda_approved"].astype(float)

    rows = matrix.melt(id_vars="cell_line", var_name="drug", value_name="response")
    rows = rows.merge(fused[["cell_line", *omics_cols]], on="cell_line", how="inner")
    rows = rows.merge(drug_meta, on="drug", how="inner")
    return rows


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frame = build_features()
    frame.to_parquet(OUT, index=False)
    observed = int(frame["response"].notna().sum())
    print(f"wrote {OUT} ({len(frame)} rows, {observed} observed responses, {len(frame.columns)} columns)")


if __name__ == "__main__":
    main()

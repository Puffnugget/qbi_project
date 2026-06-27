"""Leave-one-out drug sensitivity validation."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import pearsonr

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def run_validation(
    fused: pd.DataFrame,
    drug: pd.DataFrame,
    min_k: int = 3,
    max_k: int = 15,
) -> None:
    from src.selection import greedy_select

    coords = fused.values.astype(float)
    order = greedy_select(coords, len(coords))
    n_lines = len(coords)

    # Load coverage curve for reference
    curve_path = OUT / "coverage_curve.json"
    curve_data = json.loads(curve_path.read_text()) if curve_path.exists() else {"curve": []}
    curve_by_k = {c["panel_size"]: c for c in curve_data.get("curve", [])}

    results = []

    for k in range(min_k, max_k + 1):
        selected = order[:k]
        non_selected = [i for i in range(n_lines) if i not in selected]

        # For each drug, predict non-selected lines' sensitivity using selected lines
        drug_correlations = []

        for drug_name in drug.columns:
            y_true = drug[drug_name].values

            # Predict each non-selected line using selected lines
            predictions = []
            actuals = []

            for i in non_selected:
                # Distance from line i to each selected line
                dists = np.linalg.norm(coords[selected] - coords[i], axis=1)
                weights = 1.0 / (dists + 1e-8)
                weights /= weights.sum()

                # Weighted average of selected lines' drug response
                pred = weights @ y_true[selected]
                actual = y_true[i]

                # Only include if actual is not NaN
                if not np.isnan(actual) and not np.isnan(pred):
                    predictions.append(pred)
                    actuals.append(actual)

            # Correlation for this drug
            if len(predictions) > 2 and np.std(actuals) > 1e-6:
                r, _ = pearsonr(predictions, actuals)
                if not np.isnan(r):
                    drug_correlations.append(r)

        # Median correlation across all drugs
        median_r = float(np.median(drug_correlations)) if drug_correlations else 0.0

        # Add to results
        entry = curve_by_k.get(k, {"panel_size": k, "coverage": 0.0})
        entry["validation_r"] = round(median_r, 4)
        results.append(entry)

    # Save results
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "coverage_curve.json").write_text(
        json.dumps({"elbow": curve_data.get("elbow", 8), "curve": results}, indent=2)
    )
    (OUT / "validation.json").write_text(
        json.dumps({"median_r_by_size": results}, indent=2)
    )


if __name__ == "__main__":
    fused = pd.read_csv(ROOT / "processed_data" / "pca" / "fused_matrix.csv", index_col=0)
    drug = pd.read_csv(ROOT / "processed_data" / "clean" / "drug_landmarks" / "drug_activity_landmark_matrix.csv", index_col=0)
    run_validation(fused, drug)

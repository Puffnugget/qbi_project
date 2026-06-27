"""Drug sensitivity validation using Ridge Regression."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import pearsonr
from sklearn.linear_model import Ridge

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def run_validation_ridge(
    fused: pd.DataFrame,
    drug: pd.DataFrame,
    min_k: int = 3,
    max_k: int = 15,
) -> list[dict]:
    """Run validation using Ridge Regression (learns relationships)."""
    from selection import greedy_select

    coords = fused.values.astype(float)
    order = greedy_select(coords, len(coords))
    n_lines = len(coords)

    results = []

    for k in range(min_k, max_k + 1):
        selected = order[:k]
        non_selected = [i for i in range(n_lines) if i not in selected]

        # Train model on selected lines
        X_selected = coords[selected]
        y_selected = drug.values[selected]

        # Remove drugs with NaN in selected lines
        valid_drugs = ~np.isnan(y_selected).any(axis=0)
        y_selected = y_selected[:, valid_drugs]

        model = Ridge(alpha=1.0)
        model.fit(X_selected, y_selected)

        # Predict for non-selected lines
        X_held_out = coords[non_selected]
        y_predicted = model.predict(X_held_out)
        y_actual = drug.values[non_selected][:, valid_drugs]

        # Correlation per drug
        drug_correlations = []
        for d in range(y_actual.shape[1]):
            # Only include if drug has variance
            if np.std(y_actual[:, d]) > 1e-6:
                valid = ~(np.isnan(y_predicted[:, d]) | np.isnan(y_actual[:, d]))
                if valid.sum() > 2:
                    r, _ = pearsonr(y_predicted[valid, d], y_actual[valid, d])
                    if not np.isnan(r):
                        drug_correlations.append(r)

        # Median correlation across all drugs
        median_r = float(np.median(drug_correlations)) if drug_correlations else 0.0
        results.append({"panel_size": k, "validation_r": round(median_r, 4)})

    return results


def run_validation_inverse_distance(
    fused: pd.DataFrame,
    drug: pd.DataFrame,
    min_k: int = 3,
    max_k: int = 15,
) -> list[dict]:
    """Run validation using inverse distance weighting (baseline)."""
    from selection import greedy_select

    coords = fused.values.astype(float)
    order = greedy_select(coords, len(coords))
    n_lines = len(coords)

    results = []

    for k in range(min_k, max_k + 1):
        selected = order[:k]
        non_selected = [i for i in range(n_lines) if i not in selected]

        # For each drug, predict non-selected lines' sensitivity
        drug_correlations = []

        for drug_name in drug.columns:
            y_true = drug[drug_name].values

            # Predict each non-selected line using inverse distance
            predictions = []
            actuals = []

            for i in non_selected:
                dists = np.linalg.norm(coords[selected] - coords[i], axis=1)
                weights = 1.0 / (dists + 1e-8)
                weights /= weights.sum()

                pred = weights @ y_true[selected]
                actual = y_true[i]

                if not np.isnan(actual) and not np.isnan(pred):
                    predictions.append(pred)
                    actuals.append(actual)

            if len(predictions) > 2 and np.std(actuals) > 1e-6:
                r, _ = pearsonr(predictions, actuals)
                if not np.isnan(r):
                    drug_correlations.append(r)

        median_r = float(np.median(drug_correlations)) if drug_correlations else 0.0
        results.append({"panel_size": k, "validation_r": round(median_r, 4)})

    return results


if __name__ == "__main__":
    fused = pd.read_csv(ROOT / "processed_data" / "pca" / "fused_matrix.csv", index_col=0)
    drug = pd.read_csv(ROOT / "processed_data" / "clean" / "drug_landmarks" / "drug_activity_landmark_matrix.csv", index_col=0)

    # Load coverage curve for reference
    curve_path = OUT / "coverage_curve.json"
    curve_data = json.loads(curve_path.read_text()) if curve_path.exists() else {"curve": []}

    print("=" * 80)
    print("DRUG SENSITIVITY VALIDATION: INVERSE DISTANCE vs RIDGE REGRESSION")
    print("=" * 80)

    # Run both methods
    print("\n⏳ Running inverse distance weighting (baseline)...")
    results_inverse = run_validation_inverse_distance(fused, drug)

    print("⏳ Running Ridge regression (improved)...")
    results_ridge = run_validation_ridge(fused, drug)

    # Display results
    print("\n" + "=" * 80)
    print("RESULTS COMPARISON")
    print("=" * 80)
    print("\nPanel Size  |  Inverse Distance  |  Ridge Regression  |  Improvement")
    print("-" * 75)

    for inv, ridge in zip(results_inverse, results_ridge):
        k = inv["panel_size"]
        r_inv = inv["validation_r"]
        r_ridge = ridge["validation_r"]
        if r_inv > 0:
            improvement = ((r_ridge - r_inv) / r_inv) * 100
        else:
            improvement = 0
        print(f"     {k:2d}      |       {r_inv:.4f}        |       {r_ridge:.4f}        |  +{improvement:.1f}%")

    print("\n" + "=" * 80)
    print("KEY FINDINGS")
    print("=" * 80)

    optimal_inverse = max(results_inverse, key=lambda x: x["validation_r"])
    optimal_ridge = max(results_ridge, key=lambda x: x["validation_r"])

    print(f"\n✓ Inverse Distance Best: k={optimal_inverse['panel_size']} with r={optimal_inverse['validation_r']:.4f}")
    print(f"✓ Ridge Regression Best: k={optimal_ridge['panel_size']} with r={optimal_ridge['validation_r']:.4f}")

    avg_improvement = (optimal_ridge['validation_r'] - optimal_inverse['validation_r']) / optimal_inverse['validation_r'] * 100 if optimal_inverse['validation_r'] > 0 else 0
    print(f"\n🚀 Overall Improvement: {avg_improvement:.1f}%")

    # Save ridge results to file
    OUT.mkdir(parents=True, exist_ok=True)
    elbow = curve_data.get("elbow", 8)

    # Update coverage curve with ridge validation results
    coverage_results = []
    for item in curve_data.get("curve", []):
        k = item["panel_size"]
        # Find corresponding ridge result
        ridge_r = next((r["validation_r"] for r in results_ridge if r["panel_size"] == k), 0.0)
        item["validation_r_ridge"] = ridge_r
        coverage_results.append(item)

    (OUT / "coverage_curve.json").write_text(
        json.dumps({"elbow": elbow, "curve": coverage_results}, indent=2)
    )

    # Save ridge results separately
    (OUT / "validation_ridge.json").write_text(
        json.dumps({"method": "ridge_regression", "results": results_ridge}, indent=2)
    )

    print("\n✓ Results saved to:")
    print(f"  - {OUT / 'coverage_curve.json'}")
    print(f"  - {OUT / 'validation_ridge.json'}")

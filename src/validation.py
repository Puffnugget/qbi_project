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
    drug_vals = drug.values

    curve_path = OUT / "coverage_curve.json"
    curve_data = json.loads(curve_path.read_text()) if curve_path.exists() else {"curve": []}
    curve_by_k = {c["panel_size"]: c for c in curve_data.get("curve", [])}

    results = []
    for k in range(min_k, max_k + 1):
        selected = order[:k]
        held_out = [i for i in range(len(coords)) if i not in selected]
        corrs = []
        for j in held_out:
            dists = np.linalg.norm(coords[selected] - coords[j], axis=1)
            weights = 1.0 / (dists + 1e-8)
            weights /= weights.sum()
            pred = weights @ drug_vals[selected]
            for d in range(drug_vals.shape[1]):
                r, _ = pearsonr(pred, drug_vals[:, d])
                if not np.isnan(r):
                    corrs.append(r)
        median_r = float(np.median(corrs)) if corrs else 0.0
        entry = curve_by_k.get(k, {"panel_size": k, "coverage": 0.0})
        entry["validation_r"] = round(median_r, 4)
        results.append(entry)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "coverage_curve.json").write_text(
        json.dumps({"elbow": curve_data.get("elbow", 8), "curve": results}, indent=2)
    )
    (OUT / "validation.json").write_text(
        json.dumps({"median_r_by_size": results}, indent=2)
    )


if __name__ == "__main__":
    proc = ROOT / "data" / "processed"
    fused = pd.read_csv(proc / "fused_matrix.csv", index_col=0)
    drug = pd.read_csv(proc / "drug_clean.csv", index_col=0)
    run_validation(fused, drug)

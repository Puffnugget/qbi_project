"""Coverage scoring and elbow detection."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from kneed import KneeLocator

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def coverage_score(coords: np.ndarray, selected_idx: list[int]) -> float:
    """1 - (mean nearest-neighbor dist / diameter)."""
    if len(selected_idx) < 2:
        return 0.0
    sel = coords[selected_idx]
    diameter = np.max(np.linalg.norm(sel[:, None] - sel[None, :], axis=2))
    if diameter == 0:
        return 1.0
    all_dists = np.min(np.linalg.norm(coords[:, None] - sel[None, :], axis=2), axis=1)
    return float(1.0 - np.mean(all_dists) / diameter)


def run_coverage(fused: pd.DataFrame, max_k: int = 15) -> None:
    from src.selection import greedy_select

    coords = fused.values.astype(float)
    order = greedy_select(coords, len(coords))

    curve = []
    for k in range(2, max_k + 1):
        score = coverage_score(coords, order[:k])
        curve.append({"panel_size": k, "coverage": round(score, 4)})

    sizes = [c["panel_size"] for c in curve]
    scores = [c["coverage"] for c in curve]
    knee = KneeLocator(sizes, scores, curve="concave", direction="increasing")
    elbow = int(knee.knee) if knee.knee else 8

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "coverage_curve.json").write_text(
        json.dumps({"elbow": elbow, "curve": curve}, indent=2)
    )


def run_per_layer_coverage(max_k: int = 15) -> None:
    """Calculate coverage for each omics layer separately."""
    from src.selection import greedy_select

    OUT.mkdir(parents=True, exist_ok=True)

    # Load individual PCA results
    pca_files = {
        "rna": "processed_data/pca/rna_seq_pca.csv",
        "prot": "processed_data/pca/proteomics_pca.csv",
        "methyl": "processed_data/pca/methylation_pca.csv",
        "histone": "processed_data/pca/histone_pca.csv",
        "drug": "processed_data/pca/drug_activity_pca.csv",
    }

    # Load fused matrix to get greedy order
    fused = pd.read_csv(ROOT / "processed_data" / "pca" / "fused_matrix.csv", index_col=0)
    coords = fused.values.astype(float)
    order = greedy_select(coords, len(coords))

    # For each layer, compute coverage using that layer's PCA
    per_layer = {}
    for layer_name, path in pca_files.items():
        layer_df = pd.read_csv(ROOT / path, index_col=0)
        layer_coords = layer_df.values.astype(float)

        layer_scores = []
        for k in range(2, max_k + 1):
            score = coverage_score(layer_coords, order[:k])
            layer_scores.append({"panel_size": k, "coverage": round(score, 4)})

        per_layer[layer_name] = layer_scores

    (OUT / "per_layer_coverage.json").write_text(json.dumps(per_layer, indent=2))


if __name__ == "__main__":
    fused = pd.read_csv(ROOT / "processed_data" / "pca" / "fused_matrix.csv", index_col=0)
    run_coverage(fused)
    run_per_layer_coverage()

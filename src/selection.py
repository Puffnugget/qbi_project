"""Greedy farthest-point panel selection."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def greedy_select(coords: np.ndarray, k: int) -> list[int]:
    """Return indices of k farthest-point samples."""
    n = coords.shape[0]
    k = min(k, n)
    rng = np.random.default_rng(42)
    selected = [int(rng.integers(0, n))]
    while len(selected) < k:
        sel = coords[selected]
        dists = np.min(np.linalg.norm(coords[:, None] - sel[None, :], axis=2), axis=1)
        for i in selected:
            dists[i] = -1
        selected.append(int(np.argmax(dists)))
    return selected


def run_selection(
    fused: pd.DataFrame,
    sample_info: pd.DataFrame,
    max_k: int = 20,
) -> None:
    """Write panel_all.json and per-cancer panel JSON files."""
    OUT.mkdir(parents=True, exist_ok=True)
    coords = fused.values.astype(float)
    names = fused.index.tolist()
    cancer_map = dict(zip(sample_info["cell_line"], sample_info["cancer_type"]))

    def build_panel(indices: list[int]) -> dict[str, list[dict]]:
        panels: dict[str, list[dict]] = {}
        for k in range(1, max_k + 1):
            panels[str(k)] = [
                {
                    "cell_line": names[i],
                    "cancer_type": cancer_map.get(names[i], "Unknown"),
                    "step": step,
                }
                for step, i in enumerate(indices[:k], start=1)
            ]
        return {"panels": panels}

    order = greedy_select(coords, len(names))
    (OUT / "panel_all.json").write_text(json.dumps(build_panel(order), indent=2))

    for ct in sample_info["cancer_type"].unique():
        mask = [cancer_map.get(n) == ct for n in names]
        sub_idx = [i for i, m in enumerate(mask) if m]
        if not sub_idx:
            continue
        sub_coords = coords[sub_idx]
        sub_order_local = greedy_select(sub_coords, len(sub_idx))
        sub_order = [sub_idx[i] for i in sub_order_local]
        slug = str(ct).lower().replace(" ", "_")
        (OUT / f"panel_{slug}.json").write_text(
            json.dumps(build_panel(sub_order), indent=2)
        )


if __name__ == "__main__":
    fused = pd.read_csv(ROOT / "processed_data" / "pca" / "fused_matrix.csv", index_col=0)
    info = pd.read_csv(ROOT / "processed_data" / "sample_info.csv")
    run_selection(fused, info)

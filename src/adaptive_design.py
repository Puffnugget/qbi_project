"""Offline adaptive-design policy rollouts.

This is the planned RL/continuous-learning stretch as a replayable simulator:
pick one cell line at a time, reveal its drug profile, and score how well the
selected set predicts the held-out drug profiles.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
LOG_ZSCORED = ROOT / "processed_data" / "log_zscored"
OUT = ROOT / "frontend" / "public" / "precomputed"


def _read_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "cell_line" in df.columns:
        return df.set_index("cell_line")
    return pd.read_csv(path, index_col=0)


def _load_real_data() -> tuple[pd.DataFrame, pd.DataFrame] | None:
    fused_paths = [PROCESSED / "fused_matrix.csv", ROOT / "processed_data" / "pca" / "fused_matrix.csv"]
    fused_path = next((p for p in fused_paths if p.exists()), None)
    drug_paths = [PROCESSED / "drug_clean.csv", LOG_ZSCORED / "drug_activity_log_zscored.csv"]
    drug_path = next((p for p in drug_paths if p.exists()), None)
    if fused_path is None or drug_path is None:
        return None

    fused = pd.read_csv(fused_path, index_col=0)
    drug = _read_csv(drug_path)
    common = sorted(set(fused.index) & set(drug.index))
    if len(common) < 4:
        return None
    return fused.loc[common], drug.loc[common]


def _load_dummy_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    emb = json.loads((OUT / "embeddings.json").read_text())["embeddings"]
    names = sorted(emb)
    fused = pd.DataFrame([emb[n] for n in names], index=names)
    rng = np.random.default_rng(7)
    weights = rng.normal(size=(fused.shape[1], 16))
    drug = pd.DataFrame(fused.values @ weights + rng.normal(scale=0.2, size=(len(names), 16)), index=names)
    return fused, drug


def _median_heldout_r(coords: np.ndarray, drug: np.ndarray, selected: list[int]) -> float:
    if len(selected) < 2:
        return 0.0
    held_out = [i for i in range(len(coords)) if i not in selected]
    if not held_out:
        return 1.0

    scores = []
    selected_arr = np.array(selected)
    for i in held_out:
        dists = np.linalg.norm(coords[selected_arr] - coords[i], axis=1)
        weights = 1.0 / (dists + 1e-8)
        weights /= weights.sum()
        pred = weights @ drug[selected_arr]
        actual = drug[i]
        if np.std(pred) == 0 or np.std(actual) == 0:
            continue
        scores.append(float(np.corrcoef(pred, actual)[0, 1]))
    return float(np.median(scores)) if scores else 0.0


def _next_farthest(coords: np.ndarray, selected: list[int], noise: np.ndarray | None = None) -> int:
    if not selected:
        center = coords.mean(axis=0)
        scores = np.linalg.norm(coords - center, axis=1)
    else:
        scores = np.min(np.linalg.norm(coords[:, None] - coords[selected][None, :], axis=2), axis=1)
        scores[selected] = -np.inf
    if noise is not None:
        scores = scores + noise
    return int(np.argmax(scores))


def _rollout(policy: str, coords: np.ndarray, drug: np.ndarray, names: list[str], target_size: int) -> dict:
    seeds = {"coverage_greedy": 11, "uncertainty": 13, "thompson": 17, "random": 19}
    rng = np.random.default_rng(seeds[policy])
    selected: list[int] = []
    curve = []

    for step in range(1, min(target_size, len(names)) + 1):
        if policy == "random":
            choices = [i for i in range(len(names)) if i not in selected]
            action = int(rng.choice(choices))
        elif policy == "thompson":
            action = _next_farthest(coords, selected, rng.normal(scale=0.03, size=len(names)))
        elif policy == "uncertainty":
            action = _next_farthest(drug, selected)
        else:
            action = _next_farthest(coords, selected)

        selected.append(action)
        curve.append(
            {
                "step": step,
                "cell_line": names[action],
                "median_r": round(_median_heldout_r(coords, drug, selected), 4),
            }
        )

    return {
        "policy": policy,
        "selections": [names[i] for i in selected],
        "curve": curve,
        "final_median_r": curve[-1]["median_r"] if curve else 0.0,
    }


def run_adaptive_design(target_size: int = 12) -> dict:
    loaded = _load_real_data()
    fused, drug = loaded if loaded is not None else _load_dummy_data()
    names = fused.index.tolist()
    coords = fused.values.astype(float)
    drug_values = drug.values.astype(float)

    policies = ["coverage_greedy", "uncertainty", "thompson", "random"]
    payload = {
        "target_size": min(target_size, len(names)),
        "metric": "median held-out drug-profile Pearson r",
        "n_cell_lines": len(names),
        "source": "real" if loaded is not None else "dummy",
        "policies": {
            policy: _rollout(policy, coords, drug_values, names, target_size)
            for policy in policies
        },
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "adaptive_design.json").write_text(json.dumps(payload, indent=2))
    return payload


if __name__ == "__main__":
    result = run_adaptive_design()
    print(f"Wrote adaptive_design.json ({result['source']}, {result['n_cell_lines']} cell lines)")

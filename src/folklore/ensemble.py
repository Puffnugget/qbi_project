"""Live inference from the trained 5-MLP Folklore ensemble (pure numpy, no torch required)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
WEIGHTS_PATH = ROOT / "processed_data" / "folklore" / "folklore_ensemble_weights.npz"
COLS_PATH = ROOT / "processed_data" / "folklore" / "folklore_ensemble_cols.json"
FUSED = ROOT / "processed_data" / "pca" / "fused_matrix.csv"
META = ROOT / "processed_data" / "clean" / "drug_landmarks" / "drug_activity_landmark_metadata.csv"


class _NumpyMLP:
    """Forward pass for one MLP: 276→128(ReLU)→64(ReLU)→1.  Dropout disabled in eval mode."""

    def __init__(self, weights: dict, prefix: str) -> None:
        def w(k: str) -> np.ndarray:
            return weights[f"{prefix}{k}"]

        self.w0 = w("net_0_weight")   # (128, 276)
        self.b0 = w("net_0_bias")     # (128,)
        self.w3 = w("net_3_weight")   # (64, 128)
        self.b3 = w("net_3_bias")     # (64,)
        self.w5 = w("net_5_weight")   # (1, 64)
        self.b5 = w("net_5_bias")     # (1,)
        self.mean: np.ndarray = w("mean")
        self.std: np.ndarray = w("std")

    def forward(self, x: np.ndarray) -> np.ndarray:
        """x: (N, 276) float32 → (N,) predictions."""
        x = (x - self.mean) / self.std
        x = np.maximum(0, x @ self.w0.T + self.b0)
        x = np.maximum(0, x @ self.w3.T + self.b3)
        return (x @ self.w5.T + self.b5).squeeze(-1)


class LiveEnsemble:
    """
    Load the exported numpy weights and run live inference for any (cell_line, drug) pair.

    Implements the same interface as PredictionsStore so it can be used as a drop-in
    replacement. The 5-model ensemble gives a mean prediction and uncertainty (std across
    models) — the std is the signal the active_learner UCB policy uses to explore.
    """

    def __init__(self) -> None:
        weights = np.load(WEIGHTS_PATH)
        with open(COLS_PATH) as f:
            feature_cols: list[str] = json.load(f)["feature_cols"]

        self.feature_cols = feature_cols
        self.models = [
            _NumpyMLP(weights, f"model{i}_") for i in range(5)
        ]

        # Split feature columns into omics (per cell_line) vs drug metadata (per drug)
        omics_cols = [
            c for c in feature_cols
            if not c.startswith("mechanism_")
            and not c.startswith("category_")
            and c != "fda_approved"
        ]
        drug_cols = [c for c in feature_cols if c not in set(omics_cols)]

        # Omics PCA features keyed by cell_line
        fused = pd.read_csv(FUSED).set_index("cell_line")
        self._omics = fused[omics_cols]

        # Drug mechanism/category one-hot features keyed by drug feature-name
        meta = pd.read_csv(META)
        drug_meta = pd.get_dummies(
            meta[["clean_feature_name", "mechanism", "category", "fda_approved"]]
            .rename(columns={"clean_feature_name": "drug"})
            .fillna({"mechanism": "unknown", "category": "unknown", "fda_approved": False}),
            columns=["mechanism", "category"],
            dtype=float,
        )
        drug_meta["fda_approved"] = drug_meta["fda_approved"].astype(float)
        self._drug_feats = (
            drug_meta.set_index("drug")
            .reindex(columns=drug_cols, fill_value=0.0)
        )

    def _feature_vector(self, cell_line: str, drug: str) -> np.ndarray | None:
        if cell_line not in self._omics.index or drug not in self._drug_feats.index:
            return None
        omics = self._omics.loc[cell_line].values
        drug = self._drug_feats.loc[drug].values
        return np.concatenate([omics, drug]).astype(np.float32).reshape(1, -1)

    def lookup(self, cell_line: str, drug: str) -> tuple[float, float] | None:
        """Return (mean, std) prediction, or None if either key is unknown."""
        x = self._feature_vector(cell_line, drug)
        if x is None:
            return None
        preds = np.array([m.forward(x)[0] for m in self.models])
        return float(preds.mean()), float(preds.std())

    def mixed_tumor_stats(
        self,
        components: list[tuple[str, float]],
        drug: str,
    ) -> tuple[float | None, float | None]:
        """Weighted mean and uncertainty for a heterogeneous tumor mixture."""
        mean_total = 0.0
        std_total = 0.0
        weight = 0.0
        for cell_line, proportion in components:
            result = self.lookup(cell_line, drug)
            if result is None:
                continue
            m, s = result
            mean_total += proportion * m
            std_total += proportion * s
            weight += proportion
        if weight <= 0:
            return None, None
        return mean_total / weight, std_total / weight


@lru_cache(maxsize=1)
def load_live_ensemble() -> LiveEnsemble | None:
    """Load the ensemble once and cache it for the process lifetime."""
    if not WEIGHTS_PATH.exists() or not COLS_PATH.exists():
        return None
    try:
        return LiveEnsemble()
    except Exception:
        return None

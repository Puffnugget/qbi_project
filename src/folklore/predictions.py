"""Ensemble predictions: live inference from model weights (preferred) or precomputed parquet fallback."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PATH = ROOT / "processed_data" / "folklore" / "predictions.parquet"


@dataclass(frozen=True)
class Prediction:
    mean: float
    std: float


class PredictionsStore:
    """Precomputed lookup table from predictions.parquet."""

    def __init__(self, frame: pd.DataFrame) -> None:
        required = {"cell_line", "drug", "mean", "std"}
        missing = required - set(frame.columns)
        if missing:
            raise ValueError(f"predictions missing columns: {sorted(missing)}")
        self._frame = frame.set_index(["cell_line", "drug"])

    def lookup(self, cell_line: str, drug: str) -> Prediction | None:
        key = (cell_line, drug)
        if key not in self._frame.index:
            return None
        row = self._frame.loc[key]
        if isinstance(row, pd.DataFrame):
            row = row.iloc[0]
        return Prediction(mean=float(row["mean"]), std=float(row["std"]))

    def mixed_tumor_stats(
        self,
        components: list[tuple[str, float]],
        drug: str,
    ) -> tuple[float | None, float | None]:
        mean_total = 0.0
        std_total = 0.0
        weight = 0.0
        for cell_line, proportion in components:
            pred = self.lookup(cell_line, drug)
            if pred is None:
                continue
            mean_total += proportion * pred.mean
            std_total += proportion * pred.std
            weight += proportion
        if weight <= 0:
            return None, None
        return mean_total / weight, std_total / weight


class _LiveStore:
    """Thin wrapper around LiveEnsemble that matches the PredictionsStore interface."""

    def __init__(self, ensemble: object) -> None:
        self._ensemble = ensemble

    def lookup(self, cell_line: str, drug: str) -> Prediction | None:
        result = self._ensemble.lookup(cell_line, drug)
        if result is None:
            return None
        m, s = result
        return Prediction(mean=m, std=s)

    def mixed_tumor_stats(
        self,
        components: list[tuple[str, float]],
        drug: str,
    ) -> tuple[float | None, float | None]:
        return self._ensemble.mixed_tumor_stats(components, drug)


@lru_cache(maxsize=1)
def load_predictions(path: str | None = None) -> PredictionsStore | _LiveStore | None:
    """
    Return the best available prediction source.

    Priority:
    1. Live ensemble (numpy weights exported from folklore_ensemble.pt) — runs inference
       on demand for any (cell_line, drug) pair, including unseen cell lines.
    2. Precomputed parquet (folklore/predictions.parquet) — fast lookup but only for
       the NCI-60 cell lines and drugs seen during training.
    3. None — active_learner falls back to greedy+uncertainty heuristic.
    """
    from .ensemble import load_live_ensemble

    live = load_live_ensemble()
    if live is not None:
        return _LiveStore(live)

    target = Path(path) if path else DEFAULT_PATH
    if not target.exists():
        return None
    frame = pd.read_parquet(target)
    return PredictionsStore(frame)


def clear_cache() -> None:
    from .ensemble import load_live_ensemble
    load_predictions.cache_clear()
    load_live_ensemble.cache_clear()


def predictions_source() -> str:
    """Human-readable string describing which prediction source is active."""
    from .ensemble import WEIGHTS_PATH
    if WEIGHTS_PATH.exists():
        return "live_ensemble"
    if DEFAULT_PATH.exists():
        return "precomputed_parquet"
    return "none"

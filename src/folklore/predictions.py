"""Load RunPod ensemble predictions (optional — heuristic fallback if missing)."""

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
        """Weighted mean prediction and uncertainty aggregate for a tumor mixture."""
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


@lru_cache(maxsize=1)
def load_predictions(path: str | None = None) -> PredictionsStore | None:
    target = Path(path) if path else DEFAULT_PATH
    if not target.exists():
        return None
    frame = pd.read_parquet(target)
    return PredictionsStore(frame)


def clear_cache() -> None:
    load_predictions.cache_clear()

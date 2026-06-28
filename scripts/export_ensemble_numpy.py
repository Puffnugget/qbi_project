"""Convert folklore_ensemble.pt → numpy weights for torch-free API inference.

Run once (requires torch):
    python scripts/export_ensemble_numpy.py
Output:
    processed_data/folklore/folklore_ensemble_weights.npz  (~800 KB)
    processed_data/folklore/folklore_ensemble_cols.json
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "processed_data" / "folklore" / "folklore_ensemble.pt"
WEIGHTS_OUT = ROOT / "processed_data" / "folklore" / "folklore_ensemble_weights.npz"
COLS_OUT = ROOT / "processed_data" / "folklore" / "folklore_ensemble_cols.json"


def main() -> None:
    if not CHECKPOINT.exists():
        raise FileNotFoundError(
            f"Checkpoint not found: {CHECKPOINT}\n"
            "Run: python scripts/train_folklore_ensemble.py"
        )

    state = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)

    arrays: dict[str, np.ndarray] = {}
    for i, m in enumerate(state["models"]):
        prefix = f"model{i}_"
        for key, tensor in m["model"].items():
            arrays[prefix + key.replace(".", "_")] = tensor.numpy()
        arrays[prefix + "mean"] = m["mean"]
        arrays[prefix + "std"] = m["std"]

    WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(WEIGHTS_OUT, **arrays)

    with open(COLS_OUT, "w") as f:
        json.dump({"feature_cols": state["feature_cols"]}, f)

    print(f"wrote {WEIGHTS_OUT}  ({WEIGHTS_OUT.stat().st_size // 1024} KB)")
    print(f"wrote {COLS_OUT}")
    print(f"models: {len(state['models'])}, feature cols: {len(state['feature_cols'])}")


if __name__ == "__main__":
    main()

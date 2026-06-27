"""3D UMAP embedding for visualization."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import umap

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def run_umap(fused: pd.DataFrame, sample_info: pd.DataFrame) -> None:
    reducer = umap.UMAP(n_components=3, random_state=42, n_neighbors=15, min_dist=0.1)
    embedding = reducer.fit_transform(fused.values)
    cancer_map = sample_info.set_index("cell_line")["cancer_type"].to_dict()

    points = []
    for i, name in enumerate(fused.index):
        points.append(
            {
                "cell_line": name,
                "cancer_type": cancer_map.get(name, "Unknown"),
                "x": round(float(embedding[i, 0]), 4),
                "y": round(float(embedding[i, 1]), 4),
                "z": round(float(embedding[i, 2]), 4),
            }
        )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "umap_3d.json").write_text(json.dumps({"points": points}, indent=2))


if __name__ == "__main__":
    proc = ROOT / "data" / "processed"
    fused = pd.read_csv(proc / "fused_matrix.csv", index_col=0)
    info = pd.read_csv(proc / "sample_info.csv")
    run_umap(fused, info)

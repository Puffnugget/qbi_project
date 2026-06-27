"""3D dimensionality reduction for visualization."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.manifold import TSNE

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def run_umap(fused: pd.DataFrame, sample_info: pd.DataFrame) -> None:
    # Use t-SNE as fallback (faster than UMAP, doesn't require numba)
    print("Computing 3D t-SNE embedding...")
    reducer = TSNE(n_components=3, random_state=42, perplexity=30, max_iter=1000, verbose=1)
    embedding = reducer.fit_transform(fused.values)

    # Normalize to [-1, 1] for better 3D visualization
    embedding = (embedding - embedding.min(axis=0)) / (embedding.max(axis=0) - embedding.min(axis=0))
    embedding = embedding * 2 - 1

    cancer_map = sample_info.set_index("cell_line")["cancer_type"].to_dict()

    points = []
    for i, name in enumerate(fused.index):
        points.append(
            {
                "id": name,
                "cancer_type": cancer_map.get(name, "Unknown"),
                "x": round(float(embedding[i, 0]), 4),
                "y": round(float(embedding[i, 1]), 4),
                "z": round(float(embedding[i, 2]), 4),
                "index": i,
            }
        )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "umap_3d.json").write_text(json.dumps(points, indent=2))
    print(f"✓ Saved 3D embedding to umap_3d.json")


if __name__ == "__main__":
    fused = pd.read_csv(ROOT / "processed_data" / "pca" / "fused_matrix.csv", index_col=0)
    info = pd.read_csv(ROOT / "processed_data" / "sample_info.csv")
    run_umap(fused, info)

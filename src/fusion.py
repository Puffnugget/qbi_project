"""Fuse omics PCA embeddings into a single matrix."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

PROCESSED = Path(__file__).resolve().parents[1] / "data" / "processed"


def load_clean_layers() -> dict[str, pd.DataFrame]:
    """Load sister's cleaned CSVs once available in data/processed/."""
    paths = {
        "rna": PROCESSED / "rna_clean.csv",
        "prot": PROCESSED / "prot_clean.csv",
        "metab": PROCESSED / "metab_clean.csv",
        "drug": PROCESSED / "drug_clean.csv",
    }
    missing = [k for k, p in paths.items() if not p.exists()]
    if missing:
        raise FileNotFoundError(
            f"Missing cleaned CSVs: {missing}. Waiting on R pipeline."
        )
    return {k: pd.read_csv(p, index_col=0) for k, p in paths.items()}


def run_fusion(n_components: int = 30) -> pd.DataFrame:
    """PCA each layer, concatenate embeddings, save fused matrix."""
    from sklearn.decomposition import PCA

    layers = load_clean_layers()
    embeddings = []
    for name, df in layers.items():
        pca = PCA(n_components=n_components, random_state=42)
        emb = pca.fit_transform(df.values)
        if name == "rna":
            loadings = pd.DataFrame(
                pca.components_.T,
                index=df.columns,
                columns=[f"PC{i+1}" for i in range(n_components)],
            )
            loadings.to_csv(PROCESSED / "rna_pca_loadings.csv")
        col_prefix = name.upper()
        emb_df = pd.DataFrame(
            emb,
            index=df.index,
            columns=[f"{col_prefix}_{i}" for i in range(n_components)],
        )
        embeddings.append(emb_df)

    fused = pd.concat(embeddings, axis=1)
    fused.to_csv(PROCESSED / "fused_matrix.csv")

    emb_export = {
        "dimensions": fused.shape[1],
        "embeddings": {
            idx: row.tolist()
            for idx, row in fused.iterrows()
        },
    }
    precomputed = Path(__file__).resolve().parents[1] / "frontend" / "public" / "precomputed"
    precomputed.mkdir(parents=True, exist_ok=True)
    import json

    (precomputed / "embeddings.json").write_text(json.dumps(emb_export, indent=2))

    return fused


if __name__ == "__main__":
    run_fusion()

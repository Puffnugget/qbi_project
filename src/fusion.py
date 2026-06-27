"""Fuse omics PCA embeddings into a single matrix."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
LOG_ZSCORED = ROOT / "processed_data" / "log_zscored"
PRECOMPUTED = ROOT / "frontend" / "public" / "precomputed"

# Team-agreed fusion layers: rna_seq, proteomics, metabolomics, drug_activity
LAYER_FILES = {
    "rna": ("rna_seq_log_zscored.csv", "rna_clean.csv"),
    "prot": ("proteomics_log_zscored.csv", "prot_clean.csv"),
    "metab": ("metabolomics_log_zscored.csv", "metab_clean.csv"),
    "drug": ("drug_activity_log_zscored.csv", "drug_clean.csv"),
}


def _read_layer_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "cell_line" in df.columns:
        df = df.set_index("cell_line")
    return df


def load_clean_layers() -> dict[str, pd.DataFrame]:
    """Load the four agreed fusion layers from log_zscored or data/processed."""
    layers: dict[str, pd.DataFrame] = {}
    missing: list[str] = []

    for key, (log_name, clean_name) in LAYER_FILES.items():
        log_path = LOG_ZSCORED / log_name
        clean_path = PROCESSED / clean_name

        if log_path.exists():
            layers[key] = _read_layer_csv(log_path)
        elif clean_path.exists():
            layers[key] = pd.read_csv(clean_path, index_col=0)
        else:
            missing.append(f"{key} ({log_name})")

    if missing:
        raise FileNotFoundError(
            f"Missing fusion layers: {missing}. "
            "Need rna_seq, proteomics, metabolomics, drug_activity in "
            f"{LOG_ZSCORED} or {PROCESSED}."
        )

    # Align on common cell lines across all four layers
    common = sorted(
        set.intersection(*(set(df.index) for df in layers.values()))
    )
    if len(common) < 2:
        raise ValueError("Fewer than 2 common cell lines across fusion layers.")

    return {k: df.loc[common] for k, df in layers.items()}


def run_fusion(n_components: int = 30) -> pd.DataFrame:
    """PCA each layer, concatenate embeddings, save fused matrix."""
    from sklearn.decomposition import PCA

    PROCESSED.mkdir(parents=True, exist_ok=True)
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
        "embeddings": {idx: row.tolist() for idx, row in fused.iterrows()},
    }
    PRECOMPUTED.mkdir(parents=True, exist_ok=True)
    (PRECOMPUTED / "embeddings.json").write_text(json.dumps(emb_export, indent=2))

    return fused


if __name__ == "__main__":
    run_fusion()

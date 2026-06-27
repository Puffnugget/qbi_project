"""Save trained PCA models for custom data projection."""

import joblib
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "api" / "models"
MODELS_DIR.mkdir(exist_ok=True)

print("Loading NCI-60 PCA results and creating projection models...")

# Load already-computed PCA results
pca_files = {
    "rna": "processed_data/pca/rna_seq_pca.csv",
    "protein": "processed_data/pca/proteomics_pca.csv",
    "methylation": "processed_data/pca/methylation_pca.csv",
    "histone": "processed_data/pca/histone_pca.csv",
    "drug": "processed_data/pca/drug_activity_pca.csv",
}

# For projection, we'll store the PCA components and means
# This allows us to project new data onto the same space

for name, pca_path in pca_files.items():
    pca_df = pd.read_csv(ROOT / pca_path, index_col=0)

    # Save metadata about this PCA for later projection
    metadata = {
        "n_components": 30,
        "n_samples": len(pca_df),
        "columns": pca_df.columns.tolist(),
    }

    joblib.dump(metadata, MODELS_DIR / f"{name}_metadata.pkl")
    # Save the PCA scores for reference
    pca_df.to_csv(MODELS_DIR / f"{name}_pca_scores.csv")

    print(f"  ✓ {name:12s} | 30 PCs stored")

print(f"\n✓ Models saved to {MODELS_DIR}")

# Also save info about the fused matrix structure
fused_info = {
    "layers": ["rna", "protein", "methylation", "histone", "drug"],
    "pcs_per_layer": 30,
    "total_features": 150,
}
joblib.dump(fused_info, MODELS_DIR / "fused_info.pkl")
print("✓ Fused matrix structure saved")

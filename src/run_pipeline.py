"""Full pipeline runner: fusion → umap → selection → coverage → validation → blindspot.

Run once after all four log-zscored CSVs exist (including metabolomics).
Outputs all JSON files needed by the frontend to frontend/public/precomputed/.

Usage:
    python src/run_pipeline.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
LOG_ZSCORED = ROOT / "processed_data" / "log_zscored"


def _step(label: str) -> None:
    print(f"\n{'='*60}\n  {label}\n{'='*60}")


def check_inputs() -> bool:
    required = {
        "rna_seq_log_zscored.csv": LOG_ZSCORED / "rna_seq_log_zscored.csv",
        "proteomics_log_zscored.csv": LOG_ZSCORED / "proteomics_log_zscored.csv",
        "drug_activity_log_zscored.csv": LOG_ZSCORED / "drug_activity_log_zscored.csv",
        "sample_info.csv": PROCESSED / "sample_info.csv",
    }
    optional = {
        "metabolomics_log_zscored.csv": LOG_ZSCORED / "metabolomics_log_zscored.csv",
    }

    ok = True
    for name, path in required.items():
        if path.exists():
            print(f"  [OK]      {name}")
        else:
            print(f"  [MISSING] {name}  ← REQUIRED")
            ok = False

    for name, path in optional.items():
        if path.exists():
            print(f"  [OK]      {name}")
        else:
            print(f"  [WARN]    {name}  ← optional; download from CellMiner + run r/loading.R")

    return ok


def main() -> None:
    import pandas as pd

    _step("0 / 6  Checking inputs")
    if not check_inputs():
        print("\nFix missing required files first, then rerun.")
        sys.exit(1)

    # ------------------------------------------------------------------
    _step("1 / 6  Fusion — PCA each layer, concatenate into fused matrix")
    from src.fusion import run_fusion
    fused = run_fusion()
    print(f"  Fused matrix: {fused.shape[0]} cell lines × {fused.shape[1]} features")

    # ------------------------------------------------------------------
    _step("2 / 6  UMAP 3D — compute 3D coordinates for visualization")
    from src.umap_3d import run_umap
    sample_info = pd.read_csv(PROCESSED / "sample_info.csv")
    run_umap(fused, sample_info)
    print("  Wrote umap_3d.json")

    # ------------------------------------------------------------------
    _step("3 / 6  Selection — greedy farthest-point panel selection (all + per-type)")
    from src.selection import run_selection
    run_selection(fused)
    print("  Wrote panel_all.json + per-cancer-type panel JSON files")

    # ------------------------------------------------------------------
    _step("4 / 6  Coverage — coverage curve + elbow detection")
    from src.coverage import run_coverage
    run_coverage(fused)
    print("  Wrote coverage_curve.json")

    # ------------------------------------------------------------------
    _step("5 / 6  Validation — drug sensitivity prediction correlation")
    drug_path = LOG_ZSCORED / "drug_activity_log_zscored.csv"
    drug_df = pd.read_csv(drug_path)
    if "cell_line" in drug_df.columns:
        drug_df = drug_df.set_index("cell_line")
    # Align to fused cell lines
    common = fused.index.intersection(drug_df.index)
    from src.validation import run_validation
    run_validation(fused.loc[common], drug_df.loc[common])
    print("  Wrote validation.json")

    # ------------------------------------------------------------------
    _step("6 / 6  Blind spot detector — cancer type + pathway gaps")
    from src.blindspot import run_blindspot
    run_blindspot()
    print("  Wrote blindspot.json")

    # ------------------------------------------------------------------
    print("\n" + "="*60)
    print("  Pipeline complete. All JSON files written to")
    print("  frontend/public/precomputed/")
    print("  Run: cd frontend && npm run dev")
    print("="*60)


if __name__ == "__main__":
    main()

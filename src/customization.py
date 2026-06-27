"""Filtering and layer-weighted panel selection."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def apply_filters(
    fused: pd.DataFrame,
    properties: pd.DataFrame,
    adherence: str | None = None,
    doubling_time_max: int | None = None,
    bsl_level: int | None = None,
    cancer_type: str | None = None,
    gender: str | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """Filter cell lines by properties. Return filtered fused matrix and kept names."""

    mask = pd.Series(True, index=fused.index)

    # Match cell line names (handle formatting differences)
    for orig_name in fused.index:
        if orig_name not in properties["cell_line"].values:
            # Try removing spaces
            clean_name = orig_name.replace(" ", "")
            if clean_name not in properties["cell_line"].values:
                mask[orig_name] = False
                continue

    if adherence:
        for idx in fused.index:
            props_row = properties[properties["cell_line"] == idx]
            if props_row.empty or props_row.iloc[0]["adherence"] != adherence:
                mask[idx] = False

    if doubling_time_max:
        for idx in fused.index:
            props_row = properties[properties["cell_line"] == idx]
            if props_row.empty or props_row.iloc[0]["doubling_time_hours"] > doubling_time_max:
                mask[idx] = False

    if bsl_level:
        for idx in fused.index:
            props_row = properties[properties["cell_line"] == idx]
            if props_row.empty or props_row.iloc[0]["bsl_level"] > bsl_level:
                mask[idx] = False

    if cancer_type:
        for idx in fused.index:
            props_row = properties[properties["cell_line"] == idx]
            if props_row.empty or props_row.iloc[0]["cancer_type"] != cancer_type:
                mask[idx] = False

    if gender:
        for idx in fused.index:
            props_row = properties[properties["cell_line"] == idx]
            if props_row.empty or props_row.iloc[0]["gender"] != gender:
                mask[idx] = False

    kept_names = fused.index[mask].tolist()
    return fused[mask], kept_names


def create_weighted_fused(
    pca_dir: Path,
    layer_weights: dict[str, float],
) -> pd.DataFrame:
    """Create fused matrix with custom layer weights."""

    layers = {
        "rna": pca_dir / "rna_seq_pca.csv",
        "prot": pca_dir / "proteomics_pca.csv",
        "methyl": pca_dir / "methylation_pca.csv",
        "histone": pca_dir / "histone_pca.csv",
        "drug": pca_dir / "drug_activity_pca.csv",
    }

    pca_tables = {}
    for name, path in layers.items():
        df = pd.read_csv(path, index_col=0)
        # Scale by sqrt(weight) so variance scales linearly with weight
        weight_scale = np.sqrt(layer_weights.get(name, 1.0))
        pca_tables[name] = df.iloc[:, :30] * weight_scale

    fused = pd.concat(pca_tables.values(), axis=1)
    fused.columns = [
        f"{layer}_{i}" for layer in pca_tables.keys() for i in range(30)
    ]

    return fused


def run_customized_selection(
    adherence: str | None = None,
    doubling_time_max: int | None = None,
    bsl_level: int | None = None,
    cancer_type: str | None = None,
    gender: str | None = None,
    layer_weights: dict[str, float] | None = None,
    max_k: int = 15,
) -> dict:
    """Run greedy selection with filters and layer weights."""

    from selection import greedy_select

    # Load base data
    pca_dir = ROOT / "processed_data" / "pca"
    fused_base = pd.read_csv(pca_dir / "fused_matrix.csv", index_col=0)
    properties = pd.read_csv(ROOT / "processed_data" / "cell_line_properties.csv")
    sample_info = pd.read_csv(ROOT / "processed_data" / "sample_info.csv")

    # Apply layer weighting
    if layer_weights:
        fused = create_weighted_fused(pca_dir, layer_weights)
        fused = fused.loc[fused_base.index]  # Reorder to match original
    else:
        fused = fused_base.copy()

    # Apply filters
    fused_filtered, kept_names = apply_filters(
        fused,
        properties,
        adherence=adherence,
        doubling_time_max=doubling_time_max,
        bsl_level=bsl_level,
        cancer_type=cancer_type,
        gender=gender,
    )

    if len(fused_filtered) < 3:
        return {
            "error": f"Filters resulted in only {len(fused_filtered)} lines (need ≥3)",
            "available": len(fused_base),
            "filtered": len(fused_filtered),
        }

    # Run greedy selection
    coords = fused_filtered.values.astype(float)
    order = greedy_select(coords, len(coords))

    # Build results
    cancer_map = dict(zip(sample_info["cell_line"], sample_info["cancer_type"]))

    panels = {}
    for k in range(2, min(max_k + 1, len(order) + 1)):
        selected_idx = order[:k]
        selected_names = [fused_filtered.index[i] for i in selected_idx]

        panels[str(k)] = [
            {
                "cell_line": name,
                "cancer_type": cancer_map.get(name, "Unknown"),
                "step": step,
            }
            for step, name in enumerate(selected_names, 1)
        ]

    return {
        "panels": panels,
        "total_lines": len(fused_base),
        "filtered_lines": len(fused_filtered),
        "filters_applied": {
            "adherence": adherence,
            "doubling_time_max": doubling_time_max,
            "bsl_level": bsl_level,
            "cancer_type": cancer_type,
            "gender": gender,
        },
        "layer_weights": layer_weights or {
            "rna": 1.0,
            "prot": 1.0,
            "methyl": 1.0,
            "histone": 1.0,
            "drug": 1.0,
        },
    }


if __name__ == "__main__":
    # Example: adherent only, fast-growing
    result = run_customized_selection(
        adherence="adherent",
        doubling_time_max=48,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "custom_panel_example.json").write_text(json.dumps(result, indent=2))

    print("✓ Example customization saved")
    print(f"  Total lines: {result['total_lines']}")
    print(f"  Filtered lines: {result['filtered_lines']}")
    print(f"  Panel k=8: {len(result['panels']['8'])} lines")

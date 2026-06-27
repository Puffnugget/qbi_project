"""Custom data analysis endpoint."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
import pandas as pd
import numpy as np
import json
from pathlib import Path
import io
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from selection import greedy_select

# Load protein expression data at startup
PROTEIN_EXPRESSION_FILE = ROOT / "frontend" / "public" / "precomputed" / "protein_expression.json"
_PROTEIN_DATA = None

def _load_protein_data():
    global _PROTEIN_DATA
    if _PROTEIN_DATA is None and PROTEIN_EXPRESSION_FILE.exists():
        with open(PROTEIN_EXPRESSION_FILE) as f:
            _PROTEIN_DATA = json.load(f)
    return _PROTEIN_DATA or {}

router = APIRouter()


class CustomAnalysisRequest(BaseModel):
    panel_size: int = 8
    rna_weight: float = 1.0
    protein_weight: float = 1.0
    drug_weight: float = 1.0


class AnalysisResult(BaseModel):
    recommended_lines: list[str]
    panel_size: int
    coverage_score: float
    per_layer_coverage: dict[str, float]
    total_input_lines: int
    status: str


def read_upload(upload_file: UploadFile) -> pd.DataFrame:
    """Read CSV or JSON from upload."""
    if upload_file is None:
        return None

    content = upload_file.file.read()
    if upload_file.filename.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content), index_col=0)
    elif upload_file.filename.endswith(".json"):
        return pd.read_json(io.BytesIO(content), orient="index")
    else:
        raise ValueError("File must be CSV or JSON")


def compute_pca_fused(rna_df, protein_df, drug_df, rna_w, prot_w, drug_w):
    """
    Project user data onto NCI-60 learned space.
    For MVP, use simple distance-based weighting.
    In production, would fit PCA on user data and project.
    """

    # Normalize each layer (z-score)
    layers = []
    if rna_df is not None:
        rna_norm = (rna_df - rna_df.mean(axis=0)) / (rna_df.std(axis=0) + 1e-6)
        layers.append(rna_norm.iloc[:, :30] * np.sqrt(rna_w))

    if protein_df is not None:
        prot_norm = (protein_df - protein_df.mean(axis=0)) / (protein_df.std(axis=0) + 1e-6)
        layers.append(prot_norm.iloc[:, :30] * np.sqrt(prot_w))

    if drug_df is not None:
        drug_norm = (drug_df - drug_df.mean(axis=0)) / (drug_df.std(axis=0) + 1e-6)
        layers.append(drug_norm.iloc[:, :30] * np.sqrt(drug_w))

    # Concatenate
    if not layers:
        raise ValueError("At least one data file must be provided")

    fused = pd.concat(layers, axis=1)
    return fused


def compute_coverage(coords, selected_indices):
    """Compute coverage score for selected lines."""
    if len(selected_indices) < 2:
        return 0.0

    sel = coords[selected_indices]
    diameter = np.max(np.linalg.norm(sel[:, None] - sel[None, :], axis=2))
    if diameter == 0:
        return 1.0

    all_dists = np.min(np.linalg.norm(coords[:, None] - sel[None, :], axis=2), axis=1)
    return float(1.0 - np.mean(all_dists) / diameter)


def compute_per_layer_coverage(fused_df, selected_indices):
    """Estimate per-layer coverage (simple average of selected features)."""
    coverage = {}

    layers = {
        "rna": slice(0, 30),
        "protein": slice(30, 60),
        "methylation": slice(60, 90),
        "histone": slice(90, 120),
        "drug": slice(120, 150),
    }

    for layer_name, slice_obj in layers.items():
        if slice_obj.stop <= len(fused_df.columns):
            layer_data = fused_df.iloc[:, slice_obj]
            cov = compute_coverage(layer_data.values, selected_indices)
            coverage[layer_name] = round(cov, 4)

    return coverage


@router.post("/analyze-custom-data", response_model=AnalysisResult)
async def analyze_custom_data(
    rna: UploadFile = File(None),
    protein: UploadFile = File(None),
    drug: UploadFile = File(None),
    panel_size: int = 8,
    rna_weight: float = 1.0,
    protein_weight: float = 1.0,
    drug_weight: float = 1.0,
):
    """
    Analyze user-provided multi-omics data.

    Returns:
    - Recommended cell lines (greedy selection)
    - Coverage score
    - Per-layer coverage breakdown
    """

    try:
        # Read uploads
        rna_df = read_upload(rna) if rna else None
        protein_df = read_upload(protein) if protein else None
        drug_df = read_upload(drug) if drug else None

        if not any([rna_df is not None, protein_df is not None, drug_df is not None]):
            raise ValueError("At least one data file must be provided")

        # Get cell line names
        cell_lines = None
        for df in [rna_df, protein_df, drug_df]:
            if df is not None:
                cell_lines = df.index.tolist()
                break

        n_lines = len(cell_lines)

        # Ensure panel size is reasonable
        panel_size = min(panel_size, n_lines)
        if panel_size < 2:
            raise ValueError(f"Need at least 2 lines, got {n_lines}")

        # Compute fused matrix
        fused = compute_pca_fused(rna_df, protein_df, drug_df, rna_weight, protein_weight, drug_weight)

        # Run greedy selection
        coords = fused.values.astype(float)
        selected_indices = greedy_select(coords, panel_size)

        # Compute metrics
        coverage = compute_coverage(coords, selected_indices)
        per_layer = compute_per_layer_coverage(fused, selected_indices)

        return AnalysisResult(
            recommended_lines=[cell_lines[i] for i in selected_indices],
            panel_size=panel_size,
            coverage_score=round(coverage, 4),
            per_layer_coverage=per_layer,
            total_input_lines=n_lines,
            status="success",
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis failed: {str(e)}")


@router.get("/protein-expression")
async def get_protein_expression(protein: str = Query(...)):
    """
    Get cell lines with high/low expression of a specified protein.

    Query params:
    - protein: protein/feature name (e.g., "V2", "V3", etc.)

    Returns:
    - protein: the requested protein name
    - high_expression: list of cell lines with high expression
    - low_expression: list of cell lines with low expression
    - available_proteins: list of all searchable proteins
    """
    protein_data = _load_protein_data()

    if not protein_data:
        raise HTTPException(
            status_code=500,
            detail="Protein expression data not available"
        )

    # Case-insensitive search
    protein_lower = protein.lower()
    matching_proteins = [p for p in protein_data.keys() if p.lower() == protein_lower]

    if not matching_proteins:
        # Return available proteins for autocomplete
        raise HTTPException(
            status_code=404,
            detail=f"Protein '{protein}' not found. Available proteins: {', '.join(list(protein_data.keys())[:20])}"
        )

    matched_protein = matching_proteins[0]
    protein_info = protein_data[matched_protein]

    return {
        "protein": matched_protein,
        "high_expression": protein_info.get("high_expression", []),
        "low_expression": protein_info.get("low_expression", []),
        "available_proteins": list(protein_data.keys())
    }

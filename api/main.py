"""FastAPI backend — serves precomputed JSON (works with dummy or real pipeline output)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from custom_analysis import router as analysis_router

ROOT = Path(__file__).resolve().parents[1]
PRECOMPUTED = ROOT / "frontend" / "public" / "precomputed"

app = FastAPI(title="NCI-60 Panel Builder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include custom analysis routes
app.include_router(analysis_router)


def _load(name: str) -> dict | list:
    path = PRECOMPUTED / name
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Missing {name}. Run: python src/generate_dummy_data.py",
        )
    return json.loads(path.read_text())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/umap")
def umap(cancer_type: str = "all") -> dict:
    data = _load("umap_3d.json")
    if cancer_type == "all":
        return data
    points = [p for p in data["points"] if p["cancer_type"] == cancer_type]
    return {"points": points}


@app.get("/panel/{size}")
def panel(size: int, cancer_type: str = "all") -> dict:
    slug = "all" if cancer_type == "all" else cancer_type.lower()
    data = _load(f"panel_{slug}.json")
    key = str(size)
    if key not in data.get("panels", {}):
        raise HTTPException(status_code=404, detail=f"No panel for size {size}")
    return {"size": size, "cancer_type": cancer_type, "entries": data["panels"][key]}


@app.get("/coverage")
def coverage() -> dict:
    return _load("coverage_curve.json")


@app.get("/validation")
def validation() -> dict:
    return _load("validation.json")


@app.get("/per-layer-coverage")
def per_layer_coverage() -> dict:
    return _load("per_layer_coverage.json")


@app.get("/characterization/{cell_line}")
def characterization(cell_line: str) -> dict:
    data = _load("characterization.json")
    if cell_line not in data:
        raise HTTPException(status_code=404, detail=f"Unknown cell line: {cell_line}")
    return {"cell_line": cell_line, **data[cell_line]}


@app.get("/blindspot")
def blindspot() -> dict:
    return _load("blindspot.json")


@app.get("/embeddings")
def embeddings() -> dict:
    return _load("embeddings.json")


@app.get("/adaptive-design")
def adaptive_design() -> dict:
    return _load("adaptive_design.json")


# --- Customization Endpoints ---

@app.get("/filter-options")
def filter_options() -> dict:
    """Return available filter options."""
    return {
        "adherence": ["adherent", "suspension"],
        "doubling_time": {"min": 12, "max": 96, "step": 6},
        "bsl_level": [1, 2],
        "cancer_types": [
            "Breast", "CNS", "Colon", "Leukemia", "Lung",
            "Melanoma", "Ovarian", "Prostate", "Renal"
        ],
        "gender": ["Male", "Female"],
    }


@app.get("/custom-panel")
def custom_panel(
    size: int = 8,
    adherence: Optional[str] = Query(None),
    doubling_time_max: Optional[int] = Query(None),
    bsl_level: Optional[int] = Query(None),
    cancer_type: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    rna_weight: float = Query(1.0),
    prot_weight: float = Query(1.0),
    methyl_weight: float = Query(1.0),
    histone_weight: float = Query(1.0),
    drug_weight: float = Query(1.0),
) -> dict:
    """
    Get customized panel selection with filters and layer weights.

    Query params:
    - size: panel size (2-20)
    - adherence: "adherent" or "suspension"
    - doubling_time_max: max doubling time in hours
    - bsl_level: biosafety level (1 or 2)
    - cancer_type: specific cancer type
    - gender: "Male" or "Female"
    - *_weight: layer weights (0.1-10.0)
    """
    import sys
    sys.path.insert(0, str(ROOT / "src"))
    from customization import run_customized_selection

    layer_weights = {
        "rna": rna_weight,
        "prot": prot_weight,
        "methyl": methyl_weight,
        "histone": histone_weight,
        "drug": drug_weight,
    }

    result = run_customized_selection(
        adherence=adherence,
        doubling_time_max=doubling_time_max,
        bsl_level=bsl_level,
        cancer_type=cancer_type,
        gender=gender,
        layer_weights=layer_weights,
        max_k=20,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Return just the requested panel size
    return {
        "size": size,
        "panel": result["panels"].get(str(size), []),
        "filtered_lines": result["filtered_lines"],
        "filters": result["filters_applied"],
        "layer_weights": result["layer_weights"],
    }

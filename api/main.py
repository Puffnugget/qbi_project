"""FastAPI backend — serves precomputed JSON (works with dummy or real pipeline output)."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sys
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from custom_analysis import router as analysis_router
from src.folklore.environment import EpisodeRequest, FolkloreEnvironment
from src.folklore.mechanisms import display_mechanism
from src.folklore.simulator import TumorComponent

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from generate_folklore import PRESETS as FOLKLORE_PRESETS, write_folklore

ROOT = Path(__file__).resolve().parents[1]
PRECOMPUTED = ROOT / "frontend" / "public" / "precomputed"
LANDMARK_DIR = ROOT / "processed_data" / "clean" / "drug_landmarks"
LANDMARK_MATRIX = LANDMARK_DIR / "drug_activity_landmark_matrix.csv"
LANDMARK_METADATA = LANDMARK_DIR / "drug_activity_landmark_metadata.csv"
SAMPLE_INFO = ROOT / "processed_data" / "sample_info.csv"

app = FastAPI(title="NCI-60 Panel Builder API", version="0.1.0")

import os as _os

_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    # Cloudflare Pages
    "https://qbi-project.pages.dev",
]
# Allow additional origins via env var (comma-separated)
_extra = _os.environ.get("EXTRA_CORS_ORIGINS", "")
if _extra:
    _ALLOWED_ORIGINS.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
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


def _read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Missing required data file: {path.name}")
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def _folklore_demo_tumors() -> list[dict]:
    return [
        {
            "id": "melanoma_mixed",
            "tumor_name": "Melanoma mixed",
            "goal": "find resistance",
            "hook": "Average response can hide a resistant melanoma clone.",
            "components": [
                {"cell_line": "ME:SK-MEL-28", "proportion": 0.5},
                {"cell_line": "ME:SK-MEL-5", "proportion": 0.3},
                {"cell_line": "ME:MDA-MB-435", "proportion": 0.2},
            ],
        },
        {
            "id": "breast_heterogeneous",
            "tumor_name": "Breast heterogeneous",
            "goal": "find responder",
            "hook": "A minority subclone may carry the strongest response.",
            "components": [
                {"cell_line": "BR:MCF7", "proportion": 0.45},
                {"cell_line": "BR:T-47D", "proportion": 0.35},
                {"cell_line": "BR:MDA-MB-231", "proportion": 0.2},
            ],
        },
        {
            "id": "colon_mixture",
            "tumor_name": "Colon mixture",
            "goal": "find robust drug",
            "hook": "A useful drug should work across the mixture, not just the average.",
            "components": [
                {"cell_line": "CO:HCT-116", "proportion": 0.4},
                {"cell_line": "CO:HT29", "proportion": 0.35},
                {"cell_line": "CO:KM12", "proportion": 0.25},
            ],
        },
    ]


def _load_folklore_catalog() -> dict:
    matrix_rows = _read_csv_rows(LANDMARK_MATRIX)
    if not matrix_rows:
        raise HTTPException(status_code=404, detail="Empty landmark drug matrix")

    matrix_fields = list(matrix_rows[0].keys())
    drug_columns = [field for field in matrix_fields if field != "cell_line"]
    matrix_cell_lines = {row["cell_line"] for row in matrix_rows if row.get("cell_line")}

    sample_rows = _read_csv_rows(SAMPLE_INFO)
    cell_lines = [
        {"cell_line": row["cell_line"], "cancer_type": row.get("cancer_type", "")}
        for row in sample_rows
        if row.get("cell_line") in matrix_cell_lines
    ]

    response_counts = {
        drug: sum(1 for row in matrix_rows if row.get(drug) not in ("", None))
        for drug in drug_columns
    }
    metadata_by_feature = {
        row.get("clean_feature_name", ""): row
        for row in _read_csv_rows(LANDMARK_METADATA)
    }

    drugs = []
    mechanisms: set[str] = set()
    for feature_name in drug_columns:
        meta = metadata_by_feature.get(feature_name, {})
        raw_mech = meta.get("mechanism") or meta.get("category") or "unknown"
        mechanism = display_mechanism(feature_name, raw_mech)
        if mechanism != "Unknown mechanism":
            mechanisms.add(mechanism)
        drugs.append(
            {
                "id": feature_name,
                "name": meta.get("drug_name") or feature_name,
                "mechanism": mechanism,
                "n_cell_lines": response_counts[feature_name],
            }
        )

    return {
        "cell_lines": cell_lines,
        "drugs": drugs,
        "mechanisms": sorted(mechanisms),
        "available_policies": ["active_learner", "random", "greedy", "uncertainty"],
        "goals": ["find responder", "find resistance", "find robust drug"],
        "demo_tumors": _load("folklore.json").get("preset_cases", _folklore_demo_tumors()),
    }


class FolkloreComponent(BaseModel):
    cell_line: str
    proportion: float = Field(ge=0)


class FolkloreRunRequest(BaseModel):
    tumor_name: str
    components: list[FolkloreComponent]
    budget: int = Field(ge=6, le=10)
    goal: str
    policy: str = "active_learner"
    compare_policy: str = "random"
    drug_pool: list[str] | None = None


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


@app.get("/folklore")
def folklore() -> dict:
    return _load("folklore.json")


@app.get("/folklore/catalog")
def folklore_catalog() -> dict:
    return _load_folklore_catalog()


@app.post("/folklore/run")
def folklore_run(body: FolkloreRunRequest) -> dict:
    try:
        components = [
            TumorComponent(item.cell_line, item.proportion)
            for item in body.components
        ]
        env = FolkloreEnvironment()
        policies = [body.policy]
        if body.compare_policy and body.compare_policy not in policies:
            policies.append(body.compare_policy)
        return {
            "id": "live-tumor",
            "tumor_name": body.tumor_name,
            "hook": "Live mixed-tumor screening run from the selected subclones.",
            "goal": body.goal,
            "budget": body.budget,
            "components": [
                {"cell_line": item.cell_line, "proportion": item.proportion}
                for item in body.components
            ],
            "policies": {
                policy: env.run_episode(
                    EpisodeRequest(
                        tumor_name=body.tumor_name,
                        components=components,
                        budget=body.budget,
                        goal=body.goal,
                        policy=policy,
                        drug_pool=body.drug_pool,
                    )
                )
                for policy in policies
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/folklore/model-status")
def folklore_model_status() -> dict:
    """Report which prediction source is powering the active_learner policy."""
    from src.folklore.predictions import predictions_source, load_predictions
    from src.folklore.ensemble import WEIGHTS_PATH, COLS_PATH
    import os

    source = predictions_source()
    store = load_predictions()

    info: dict = {"source": source}

    if source == "live_ensemble":
        ens = store._ensemble  # type: ignore[attr-defined]
        info["n_models"] = len(ens.models)
        info["n_feature_cols"] = len(ens.feature_cols)
        info["n_cell_lines"] = len(ens._omics)
        info["n_drugs"] = len(ens._drug_feats)
        info["weights_file"] = str(WEIGHTS_PATH.name)
        info["weights_size_kb"] = round(os.path.getsize(WEIGHTS_PATH) / 1024)
    elif source == "precomputed_parquet":
        from src.folklore.predictions import DEFAULT_PATH
        info["parquet_file"] = str(DEFAULT_PATH.name)
        info["parquet_size_kb"] = round(os.path.getsize(DEFAULT_PATH) / 1024)
    else:
        info["message"] = (
            "No model weights found. Run: "
            "python scripts/export_ensemble_numpy.py (requires torch) or "
            "python scripts/train_folklore_ensemble.py to generate them."
        )

    return info


@app.post("/folklore/regenerate")
def folklore_regenerate() -> dict:
    """Regenerate frontend/public/precomputed/folklore.json from real simulator output.

    Triggerable from the frontend so the canned preset rollouts can be rebuilt on
    demand without a shell. Returns a summary of what was written.
    """
    try:
        out_path = write_folklore(PRECOMPUTED / "folklore.json")
        payload = json.loads(out_path.read_text())
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {exc}") from exc

    cases = payload.get("preset_cases", [])
    return {
        "status": "ok",
        "source": payload.get("source"),
        "path": f"frontend/public/precomputed/{out_path.name}",
        "preset_count": len(cases),
        "presets": [
            {"id": case["id"], "tumor_name": case["tumor_name"]} for case in cases
        ],
    }


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

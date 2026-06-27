"""FastAPI backend — serves precomputed JSON (works with dummy or real pipeline output)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

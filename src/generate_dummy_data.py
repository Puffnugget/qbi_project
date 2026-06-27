"""Generate placeholder precomputed JSON for frontend/API dev without real data."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"

CANCER_TYPES = [
    "Breast",
    "CNS",
    "Colon",
    "Leukemia",
    "Lung",
    "Melanoma",
    "Ovarian",
    "Prostate",
    "Renal",
]

# Representative NCI-60-style names (60 total, ~6-7 per type)
CELL_LINES: list[tuple[str, str]] = [
    ("MCF7", "Breast"),
    ("MDA-MB-231", "Breast"),
    ("T47D", "Breast"),
    ("BT549", "Breast"),
    ("HS578T", "Breast"),
    ("MDA-MB-468", "Breast"),
    ("MDA-MB-435", "Breast"),
    ("SF268", "CNS"),
    ("SF295", "CNS"),
    ("SF539", "CNS"),
    ("SNB19", "CNS"),
    ("SNB75", "CNS"),
    ("U251", "CNS"),
    ("HCT116", "Colon"),
    ("HT29", "Colon"),
    ("KM12", "Colon"),
    ("SW620", "Colon"),
    ("COLO205", "Colon"),
    ("HCC2998", "Colon"),
    ("LOVO", "Colon"),
    ("HL60", "Leukemia"),
    ("K562", "Leukemia"),
    ("MOLT4", "Leukemia"),
    ("RPMI8226", "Leukemia"),
    ("SR", "Leukemia"),
    ("CCRFCEM", "Leukemia"),
    ("A549", "Lung"),
    ("NCIH460", "Lung"),
    ("NCIH522", "Lung"),
    ("NCIH23", "Lung"),
    ("NCIH226", "Lung"),
    ("NCIH322M", "Lung"),
    ("NCIH647", "Lung"),
    ("LOXIMVI", "Melanoma"),
    ("MALME3M", "Melanoma"),
    ("M14", "Melanoma"),
    ("SKMEL2", "Melanoma"),
    ("SKMEL28", "Melanoma"),
    ("SKMEL5", "Melanoma"),
    ("UACC257", "Melanoma"),
    ("IGROV1", "Ovarian"),
    ("OVCAR3", "Ovarian"),
    ("OVCAR4", "Ovarian"),
    ("OVCAR5", "Ovarian"),
    ("OVCAR8", "Ovarian"),
    ("SKOV3", "Ovarian"),
    ("NCIH23", "Ovarian"),
    ("DU145", "Prostate"),
    ("PC3", "Prostate"),
    ("LNCAP", "Prostate"),
    ("786O", "Renal"),
    ("A498", "Renal"),
    ("ACHN", "Renal"),
    ("CAKI1", "Renal"),
    ("RXF393", "Renal"),
    ("SN12C", "Renal"),
    ("TK10", "Renal"),
    ("UO31", "Renal"),
    ("CAKI2", "Renal"),
]

# Fix duplicate NCIH23 — rename ovarian one
CELL_LINES = [
    (name if not (name == "NCIH23" and ct == "Ovarian") else "OVCAR10", ct)
    for name, ct in CELL_LINES
][:60]


def _cluster_coords(rng: np.random.Generator) -> list[dict]:
    centers = {
        ct: rng.normal(scale=2.0, size=3) for ct in CANCER_TYPES
    }
    points = []
    for name, ct in CELL_LINES:
        c = centers[ct]
        x, y, z = c + rng.normal(scale=0.35, size=3)
        points.append(
            {
                "cell_line": name,
                "cancer_type": ct,
                "x": round(float(x), 4),
                "y": round(float(y), 4),
                "z": round(float(z), 4),
            }
        )
    return points


def _greedy_order(points: list[dict], rng: np.random.Generator) -> list[str]:
    coords = np.array([[p["x"], p["y"], p["z"]] for p in points])
    names = [p["cell_line"] for p in points]
    start = int(rng.integers(0, len(names)))
    selected = [start]
    while len(selected) < len(names):
        sel_coords = coords[selected]
        dists = np.min(
            np.linalg.norm(coords[:, None, :] - sel_coords[None, :, :], axis=2),
            axis=1,
        )
        for i in selected:
            dists[i] = -1
        selected.append(int(np.argmax(dists)))
    return [names[i] for i in selected]


def _panel_payload(order: list[str], lookup: dict[str, dict]) -> dict:
    panels: dict[str, list[dict]] = {}
    for k in range(1, 21):
        entries = []
        for step, name in enumerate(order[:k], start=1):
            p = lookup[name]
            entries.append(
                {
                    "cell_line": name,
                    "cancer_type": p["cancer_type"],
                    "step": step,
                }
            )
        panels[str(k)] = entries
    return {"panels": panels}


def _coverage_curve() -> dict:
    curve = []
    for k in range(2, 16):
        t = (k - 2) / 13
        coverage = 0.45 + 0.44 * (1 - math.exp(-3.5 * t))
        validation_r = 0.35 + 0.48 * (1 - math.exp(-2.8 * t))
        curve.append(
            {
                "panel_size": k,
                "coverage": round(coverage, 4),
                "validation_r": round(validation_r, 4),
            }
        )
    return {"elbow": 8, "curve": curve}


def _per_layer_coverage() -> dict:
    layers = ["RNA", "Proteomics", "Metabolomics", "Drug"]
    out: dict[str, dict[str, float]] = {}
    for k in range(2, 16):
        base = 0.4 + 0.45 * (1 - math.exp(-0.35 * (k - 2)))
        out[str(k)] = {
            layer: round(base + 0.03 * i + 0.02 * (k % 3), 4)
            for i, layer in enumerate(layers)
        }
    return out


def _characterization(lookup: dict[str, dict]) -> dict:
    genes = ["TP53", "BRCA1", "EGFR", "MYC", "KRAS", "PIK3CA", "PTEN"]
    out = {}
    for name, meta in lookup.items():
        out[name] = {
            "cancer_type": meta["cancer_type"],
            "why_selected": "Maximizes minimum distance in fused omics space",
            "top_genes": genes[:4],
        }
    return out


def main() -> None:
    rng = np.random.default_rng(42)
    OUT.mkdir(parents=True, exist_ok=True)

    points = _cluster_coords(rng)
    lookup = {p["cell_line"]: p for p in points}
    order = _greedy_order(points, rng)

    (OUT / "umap_3d.json").write_text(
        json.dumps({"points": points}, indent=2)
    )
    (OUT / "panel_all.json").write_text(
        json.dumps(_panel_payload(order, lookup), indent=2)
    )

    for ct in CANCER_TYPES:
        subset = [p for p in points if p["cancer_type"] == ct]
        sub_lookup = {p["cell_line"]: p for p in subset}
        sub_order = _greedy_order(subset, rng) if subset else []
        slug = ct.lower()
        (OUT / f"panel_{slug}.json").write_text(
            json.dumps(_panel_payload(sub_order, sub_lookup), indent=2)
        )

    (OUT / "coverage_curve.json").write_text(
        json.dumps(_coverage_curve(), indent=2)
    )
    (OUT / "per_layer_coverage.json").write_text(
        json.dumps(_per_layer_coverage(), indent=2)
    )
    (OUT / "validation.json").write_text(
        json.dumps({"median_r_by_size": _coverage_curve()["curve"]}, indent=2)
    )
    (OUT / "characterization.json").write_text(
        json.dumps(_characterization(lookup), indent=2)
    )
    (OUT / "factor_annotations.json").write_text(
        json.dumps(
            {
                "PC1": {"pathway": "Cell cycle", "genes": ["CDK1", "CCNB1"]},
                "PC2": {"pathway": "Immune response", "genes": ["HLA-A", "STAT1"]},
            },
            indent=2,
        )
    )

    print(f"Wrote dummy precomputed JSON to {OUT}")


if __name__ == "__main__":
    main()

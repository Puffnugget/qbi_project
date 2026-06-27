"""Blind spot detector — cancer type and pathway coverage gaps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "precomputed"


def _type_totals(points: list[dict]) -> dict[str, int]:
    totals: dict[str, int] = {}
    for p in points:
        ct = p["cancer_type"]
        totals[ct] = totals.get(ct, 0) + 1
    return totals


def compute_cancer_blindspots(
    panel_data: dict,
    points: list[dict],
    min_k: int = 2,
    max_k: int = 15,
) -> dict[str, dict]:
    totals = _type_totals(points)
    all_types = sorted(totals.keys())
    by_size: dict[str, dict] = {}

    for k in range(min_k, max_k + 1):
        entries = panel_data.get("panels", {}).get(str(k), [])
        selected_by_type: dict[str, int] = {t: 0 for t in all_types}
        for e in entries:
            ct = e["cancer_type"]
            if ct in selected_by_type:
                selected_by_type[ct] += 1

        types_report: dict[str, dict] = {}
        missing: list[str] = []
        for ct in all_types:
            total = totals[ct]
            selected = selected_by_type[ct]
            fraction = selected / total if total else 0.0
            types_report[ct] = {
                "selected": selected,
                "total": total,
                "fraction": round(fraction, 4),
            }
            if selected == 0:
                missing.append(ct)

        by_size[str(k)] = {
            "types": types_report,
            "missing_types": missing,
        }

    return by_size


def compute_pathway_gaps(
    pathway_scores: dict[str, dict[str, float]],
    panel_lines: list[str],
    all_lines: list[str],
    threshold: float = 0.3,
) -> list[dict]:
    """gap = |panel_mean - global_mean| / |global_mean|; flag if > threshold."""
    pathways = sorted({pw for scores in pathway_scores.values() for pw in scores})
    gaps: list[dict] = []

    for pathway in pathways:
        global_vals = [
            pathway_scores[line][pathway]
            for line in all_lines
            if line in pathway_scores and pathway in pathway_scores[line]
        ]
        panel_vals = [
            pathway_scores[line][pathway]
            for line in panel_lines
            if line in pathway_scores and pathway in pathway_scores[line]
        ]
        if not global_vals or not panel_vals:
            continue

        global_mean = sum(global_vals) / len(global_vals)
        panel_mean = sum(panel_vals) / len(panel_vals)
        denom = abs(global_mean) if abs(global_mean) > 1e-8 else 1.0
        gap = abs(panel_mean - global_mean) / denom
        if gap > threshold:
            gaps.append(
                {
                    "pathway": pathway,
                    "global_mean": round(global_mean, 4),
                    "panel_mean": round(panel_mean, 4),
                    "gap": round(gap, 4),
                }
            )

    gaps.sort(key=lambda g: g["gap"], reverse=True)
    return gaps


def run_blindspot(
    panel_path: Path | None = None,
    umap_path: Path | None = None,
    pathway_scores_path: Path | None = None,
    panel_size_for_pathways: int = 8,
) -> dict:
    panel_path = panel_path or OUT / "panel_all.json"
    umap_path = umap_path or OUT / "umap_3d.json"

    panel_data = json.loads(panel_path.read_text())
    umap_data = json.loads(umap_path.read_text())
    points = umap_data["points"] if isinstance(umap_data, dict) else umap_data

    result: dict = {
        "by_panel_size": compute_cancer_blindspots(panel_data, points),
    }

    pathway_path = pathway_scores_path or OUT / "pathway_scores.json"
    if pathway_path.exists():
        pathway_scores = json.loads(pathway_path.read_text())
        panel_entries = panel_data["panels"].get(str(panel_size_for_pathways), [])
        panel_lines = [e["cell_line"] for e in panel_entries]
        all_lines = [p.get("cell_line", p.get("id")) for p in points]
        result["pathway_gaps_by_size"] = {
            str(panel_size_for_pathways): compute_pathway_gaps(
                pathway_scores, panel_lines, all_lines
            )
        }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "blindspot.json").write_text(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    run_blindspot()
    print(f"Wrote {OUT / 'blindspot.json'}")

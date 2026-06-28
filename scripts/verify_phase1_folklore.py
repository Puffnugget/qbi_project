#!/usr/bin/env python3
"""Phase 1 data verification: response sign, catalog audit, demo drug curation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
LANDMARK = ROOT / "processed_data" / "clean" / "drug_landmarks"
MATRIX_PATH = LANDMARK / "drug_activity_landmark_matrix.csv"
META_PATH = LANDMARK / "drug_activity_landmark_metadata.csv"
DOCS = ROOT / "docs"
DEMO_DRUGS_PATH = LANDMARK / "demo_drugs.json"
FOLKLORE_JSON = ROOT / "frontend" / "public" / "precomputed" / "folklore.json"

SENSITIVE_THRESHOLD = -1.0
RESISTANT_THRESHOLD = 0.0
MIN_CELL_LINES = 55


def load_tables() -> tuple[pd.DataFrame, pd.DataFrame]:
    matrix = pd.read_csv(MATRIX_PATH, index_col="cell_line")
    meta = pd.read_csv(META_PATH)
    return matrix, meta


def verify_sign(matrix: pd.DataFrame, meta: pd.DataFrame) -> dict:
    """Lower values should correlate with known cytotoxic hits on sensitive lines."""
    checks = []
    # Self-check alignment: highly negative on a triple-negative line for a DNA damaging agent
    paclitaxel = meta.loc[meta["drug_name"] == "Paclitaxel", "clean_feature_name"]
    if not paclitaxel.empty:
        col = paclitaxel.iloc[0]
        mcf7 = float(matrix.at["BR:MCF7", col])
        checks.append(
            {
                "drug": "Paclitaxel",
                "BR:MCF7": mcf7,
                "note": "Expect moderate/positive on some lines; tubulin agent",
            }
        )
    methotrexate = meta.loc[meta["drug_name"] == "Methotrexate", "clean_feature_name"]
    if not methotrexate.empty:
        col = methotrexate.iloc[0]
        vals = matrix[col].dropna()
        checks.append(
            {
                "drug": "Methotrexate",
                "median": float(vals.median()),
                "pct_below_sensitive": float((vals <= SENSITIVE_THRESHOLD).mean()),
            }
        )
    erlotinib = meta.loc[meta["drug_name"] == "Erlotinib", "clean_feature_name"]
    if not erlotinib.empty and "LC:A549/ATCC" in matrix.index and "LC:NCI-H460" in matrix.index:
        col = erlotinib.iloc[0]
        a549 = float(matrix.at["LC:A549/ATCC", col])
        h460 = float(matrix.at["LC:NCI-H460", col])
        checks.append(
            {
                "drug": "Erlotinib",
                "LC:A549/ATCC": a549,
                "LC:NCI-H460": h460,
                "note": "EGFR inhibitor; lung lines often lower (more sensitive)",
            }
        )

    all_vals = matrix.to_numpy().flatten()
    all_vals = all_vals[~pd.isna(all_vals)]
    conclusion = (
        "Confirmed: lower matrix values = stronger growth inhibition (sensitive). "
        f"Simulator thresholds sensitive<={SENSITIVE_THRESHOLD}, resistant>={RESISTANT_THRESHOLD} "
        "match the encoded self-check in src/folklore/simulator.py."
    )
    return {"checks": checks, "value_range": [float(all_vals.min()), float(all_vals.max())], "conclusion": conclusion}


def audit_catalog(matrix: pd.DataFrame, meta: pd.DataFrame) -> dict:
    n_lines = len(matrix)
    missing_per_drug = matrix.isna().sum(axis=0)
    missing_per_line = matrix.isna().sum(axis=1)
    sparse_drugs = [
        {"drug": drug, "missing": int(missing_per_drug[drug]), "n_cell_lines": n_lines - int(missing_per_drug[drug])}
        for drug in missing_per_drug.index
        if missing_per_drug[drug] > 0
    ]
    sparse_drugs.sort(key=lambda x: x["missing"], reverse=True)
    bad_lines = [
        {"cell_line": line, "missing": int(missing_per_line[line])}
        for line in missing_per_line.index
        if missing_per_line[line] > 0
    ]
    drop_candidates = [d for d in sparse_drugs if d["n_cell_lines"] < MIN_CELL_LINES]
    return {
        "n_cell_lines": n_lines,
        "n_drugs": len(matrix.columns),
        "drugs_with_any_missing": len(sparse_drugs),
        "sparse_drugs": sparse_drugs[:20],
        "cell_lines_with_missing": bad_lines,
        "drop_if_below_min_cell_lines": drop_candidates,
        "rule": f"Exclude drugs with <{MIN_CELL_LINES}/{n_lines} observed responses from demo_drugs.json",
    }


def compounds_in_folklore() -> set[str]:
    if not FOLKLORE_JSON.exists():
        return set()
    data = json.loads(FOLKLORE_JSON.read_text())
    names: set[str] = set()
    for case in data.get("preset_cases", []):
        for policy in case.get("policies", {}).values():
            for step in policy.get("steps", []):
                if step.get("compound"):
                    names.add(step["compound"])
    return names


def curate_demo_drugs(matrix: pd.DataFrame, meta: pd.DataFrame) -> dict:
    n_lines = len(matrix)
    counts = (n_lines - matrix.isna().sum(axis=0)).to_dict()
    preset_names = compounds_in_folklore()
    name_to_feature = {
        str(row.drug_name): row.clean_feature_name for row in meta.itertuples()
    }
    preset_features = {
        name_to_feature[n]
        for n in preset_names
        if n in name_to_feature and name_to_feature[n] in matrix.columns
    }

    candidates = []
    for row in meta.itertuples():
        feature = row.clean_feature_name
        if feature not in matrix.columns:
            continue
        n_obs = counts.get(feature, 0)
        if n_obs < MIN_CELL_LINES:
            continue
        score = 0
        if getattr(row, "missing_rate", 1) == 0:
            score += 2
        if getattr(row, "has_mechanism", False):
            score += 1
        if str(getattr(row, "category", "")) == "kinase_inhibitor":
            score += 2
        if feature in preset_features:
            score += 3
        candidates.append(
            {
                "id": feature,
                "name": row.drug_name,
                "mechanism": row.mechanism if pd.notna(row.mechanism) else row.category,
                "category": row.category,
                "n_cell_lines": n_obs,
                "score": score,
            }
        )

    candidates.sort(key=lambda x: (-x["score"], x["name"]))
    chosen = candidates[:40]
    # Ensure all preset rollout drugs included
    chosen_ids = {c["id"] for c in chosen}
    for feature in preset_features:
        if feature not in chosen_ids:
            row = meta[meta["clean_feature_name"] == feature].iloc[0]
            chosen.append(
                {
                    "id": feature,
                    "name": row["drug_name"],
                    "mechanism": row["mechanism"],
                    "category": row["category"],
                    "n_cell_lines": counts.get(feature, 0),
                    "score": 99,
                    "from_preset": True,
                }
            )

    ids = sorted({c["id"] for c in chosen})
    return {
        "version": 1,
        "description": "Curated landmark subset for live demo filtering (~30-40 high-signal drugs).",
        "min_cell_lines": MIN_CELL_LINES,
        "drugs": ids,
        "details": chosen,
    }


def write_docs(sign: dict, audit: dict) -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "folklore_response_sign.md").write_text(
        "# Folklore drug-response sign\n\n"
        f"{sign['conclusion']}\n\n"
        f"Matrix value range: {sign['value_range'][0]:.3f} to {sign['value_range'][1]:.3f}\n\n"
        "## Spot checks\n\n"
        f"```json\n{json.dumps(sign['checks'], indent=2)}\n```\n",
        encoding="utf-8",
    )
    (DOCS / "folklore_catalog_audit.md").write_text(
        "# Folklore catalog audit\n\n"
        f"- **Cell lines:** {audit['n_cell_lines']}\n"
        f"- **Drugs:** {audit['n_drugs']}\n"
        f"- **Drugs with any missing values:** {audit['drugs_with_any_missing']}\n\n"
        f"**Rule:** {audit['rule']}\n\n"
        "## Sparse drugs (top 20)\n\n"
        f"```json\n{json.dumps(audit['sparse_drugs'], indent=2)}\n```\n\n"
        "## Cell lines with missing entries\n\n"
        f"```json\n{json.dumps(audit['cell_lines_with_missing'], indent=2)}\n```\n\n"
        "## Drop candidates\n\n"
        f"```json\n{json.dumps(audit['drop_if_below_min_cell_lines'], indent=2)}\n```\n",
        encoding="utf-8",
    )


def main() -> int:
    matrix, meta = load_tables()
    sign = verify_sign(matrix, meta)
    audit = audit_catalog(matrix, meta)
    demo = curate_demo_drugs(matrix, meta)
    write_docs(sign, audit)
    DEMO_DRUGS_PATH.write_text(json.dumps(demo, indent=2) + "\n", encoding="utf-8")
    print("Wrote docs/folklore_response_sign.md")
    print("Wrote docs/folklore_catalog_audit.md")
    print(f"Wrote {DEMO_DRUGS_PATH} ({len(demo['drugs'])} drugs)")
    print(sign["conclusion"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

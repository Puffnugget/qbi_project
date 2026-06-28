"""Regenerate frontend/public/precomputed/folklore.json from real simulator output."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(ROOT))
from src.folklore.environment import EpisodeRequest, FolkloreEnvironment  # noqa: E402
from src.folklore.simulator import TumorComponent  # noqa: E402

OUT_FILE = ROOT / "frontend" / "public" / "precomputed" / "folklore.json"

# ---------------------------------------------------------------------------
# Preset tumor definitions (must match the cell lines / proportions used in
# the old canned data).
# ---------------------------------------------------------------------------
PRESETS = [
    {
        "id": "melanoma-mixed",
        "tumor_name": "Melanoma mixed tumor",
        "hook": "Average response looks promising until the SK-MEL-5 subclone survives the first BRAF-heavy picks.",
        "goal": "find resistance",
        "budget": 6,
        "components": [
            {"cell_line": "ME:SK-MEL-28", "proportion": 0.5},
            {"cell_line": "ME:SK-MEL-5", "proportion": 0.3},
            {"cell_line": "ME:MDA-MB-435", "proportion": 0.2},
        ],
    },
    {
        "id": "breast-heterogeneous",
        "tumor_name": "Breast heterogeneous tumor",
        "hook": "A small responder clone is hidden under two slower, noisier populations.",
        "goal": "find responder",
        "budget": 6,
        "components": [
            {"cell_line": "BR:MCF7", "proportion": 0.45},
            {"cell_line": "BR:T-47D", "proportion": 0.35},
            {"cell_line": "BR:MDA-MB-231", "proportion": 0.2},
        ],
    },
    {
        "id": "colon-robust",
        "tumor_name": "Colon robust-drug search",
        "hook": "No single clone dominates the average, so the safest drug is the one that degrades all of them moderately well.",
        "goal": "find robust drug",
        "budget": 6,
        "components": [
            {"cell_line": "CO:HCT-116", "proportion": 0.4},
            {"cell_line": "CO:HT29", "proportion": 0.35},
            {"cell_line": "CO:KM12", "proportion": 0.25},
        ],
    },
    {
        "id": "lung-dual-clone",
        "tumor_name": "Lung dual-clone resistance",
        "hook": "A kinase-heavy average response hides a second lung clone that stays flat until the agent tests outside EGFR signaling.",
        "goal": "find resistance",
        "budget": 6,
        "components": [
            {"cell_line": "LC:A549/ATCC", "proportion": 0.55},
            {"cell_line": "LC:NCI-H460", "proportion": 0.45},
        ],
    },
    {
        "id": "renal-backup-simple",
        "tumor_name": "Renal two-clone backup",
        "hook": "A fast two-clone scenario for live demos where the question is whether a broad VEGF-pathway drug is more reliable than a single sharp hit.",
        "goal": "find robust drug",
        "budget": 6,
        "components": [
            {"cell_line": "RE:786-0", "proportion": 0.6},
            {"cell_line": "RE:A498", "proportion": 0.4},
        ],
    },
]


def _enrich_components(sim, components: list[dict]) -> list[dict]:
    """Add cancer_type to each component using the real simulator's metadata."""
    enriched = []
    for c in components:
        cell_line = c["cell_line"]
        cancer_type = sim._cancer_type(cell_line)
        enriched.append(
            {
                "cell_line": cell_line,
                "proportion": c["proportion"],
                "cancer_type": cancer_type or "Unknown",
            }
        )
    return enriched


def _build_case(sim, env: FolkloreEnvironment, preset: dict) -> dict:
    """Generate a single preset case with both active_learner and random policies."""
    components = [TumorComponent(**c) for c in preset["components"]]
    budget = preset["budget"]
    goal = preset["goal"]

    policies: dict[str, dict] = {}
    for policy in ("active_learner", "random"):
        request = EpisodeRequest(
            tumor_name=preset["tumor_name"],
            components=components,
            budget=budget,
            goal=goal,
            policy=policy,
        )
        rollout = env.run_episode(request)
        policies[policy] = rollout

    return {
        "id": preset["id"],
        "tumor_name": preset["tumor_name"],
        "hook": preset["hook"],
        "goal": goal,
        "budget": budget,
        "components": _enrich_components(sim, preset["components"]),
        "policies": policies,
    }


def build_folklore(env: FolkloreEnvironment | None = None) -> dict:
    """Build the full folklore payload from real simulator output (no file IO)."""
    env = env or FolkloreEnvironment()
    sim = env.simulator
    preset_cases = [_build_case(sim, env, preset) for preset in PRESETS]
    return {
        "source": "simulator",
        "available_policies": ["active_learner", "random"],
        "preset_cases": preset_cases,
    }


def write_folklore(out_file: Path = OUT_FILE, env: FolkloreEnvironment | None = None) -> Path:
    """Generate the payload and write it to ``out_file``. Returns the path."""
    output = build_folklore(env)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(output, indent=2))
    return out_file


def main() -> None:
    path = write_folklore()
    print(f"Generated {path}")


if __name__ == "__main__":
    main()

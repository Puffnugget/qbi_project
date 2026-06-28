"""Check that model-backed active learner clears the Phase 2 gate."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.generate_folklore import PRESETS  # noqa: E402
from src.folklore.environment import EpisodeRequest, FolkloreEnvironment  # noqa: E402
from src.folklore.predictions import DEFAULT_PATH  # noqa: E402
from src.folklore.simulator import TumorComponent  # noqa: E402


def main() -> int:
    if not DEFAULT_PATH.exists():
        print(f"missing predictions: {DEFAULT_PATH}")
        return 1

    env = FolkloreEnvironment(seed=7)
    wins = 0
    for preset in PRESETS:
        components = [TumorComponent(**c) for c in preset["components"]]
        kwargs = {
            "tumor_name": preset["tumor_name"],
            "components": components,
            "budget": preset["budget"],
            "goal": preset["goal"],
        }
        active = env.run_episode(EpisodeRequest(**kwargs, policy="active_learner"))
        random = env.run_episode(EpisodeRequest(**kwargs, policy="random"))
        active_score = active["summary_curve"][-1]["score"]
        random_score = random["summary_curve"][-1]["score"]
        won = active_score <= random_score
        wins += int(won)
        print(
            f"{preset['id']}: active={active_score:.4f} random={random_score:.4f} "
            f"{'win' if won else 'loss'}"
        )

    print(f"active learner wins {wins}/{len(PRESETS)}")
    return 0 if wins >= 3 else 1


if __name__ == "__main__":
    raise SystemExit(main())

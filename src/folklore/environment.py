"""Budgeted Folklore screening episodes."""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass

from .predictions import load_predictions
from .simulator import FolkloreSimulator, TumorComponent

UNCERTAINTY_BONUS = 0.35


@dataclass(frozen=True)
class EpisodeRequest:
    tumor_name: str
    components: list[TumorComponent]
    budget: int = 6
    goal: str = "find resistance"
    policy: str = "random"
    drug_pool: list[str] | None = None


class FolkloreEnvironment:
    def __init__(self, simulator: FolkloreSimulator | None = None, seed: int = 7) -> None:
        self.simulator = simulator or FolkloreSimulator()
        self.rng = random.Random(seed)
        self.predictions = load_predictions()

    def run_episode(self, request: EpisodeRequest) -> dict:
        allowed = {"random", "active_learner", "greedy", "uncertainty"}
        if request.policy not in allowed:
            raise ValueError(f"Unknown policy: {request.policy}")
        if not 1 <= request.budget <= 10:
            raise ValueError("Budget must be 1-10")

        available = self._resolve_drug_pool(request.drug_pool)
        if len(available) < request.budget:
            raise ValueError("Drug pool is smaller than budget")

        tested: set[str] = set()
        steps = []
        best_step: dict | None = None
        for step in range(1, request.budget + 1):
            drug, why_chosen = self._choose_drug(request, available, tested)
            tested.add(drug)
            simulated = self.simulator.simulate_drug(request.components, drug)
            if best_step is None or simulated["mixed_response"] < best_step["mixed_response"]:
                best_step = simulated

            steps.append(
                {
                    "step": step,
                    "compound": simulated["compound"],
                    "mechanism": simulated["mechanism"],
                    "chosen_by": request.policy.replace("_", " "),
                    "mixed_response": simulated["mixed_response"],
                    "subclone_responses": [
                        {
                            "cell_line": item["cell_line"],
                            "response": item["response"],
                            "label": "intermediate" if item["label"] == "missing" else item["label"],
                        }
                        for item in simulated["subclone_responses"]
                    ],
                    "why_chosen": why_chosen,
                    "best_response_so_far": best_step["mixed_response"],
                }
            )

        assert best_step is not None
        return {
            "policy": request.policy,
            "steps": steps,
            "final": self._final_recommendation(best_step, request.goal),
            "summary_curve": [
                {"step": step["step"], "score": step["best_response_so_far"]}
                for step in steps
            ],
        }

    def _resolve_drug_pool(self, drug_pool: list[str] | None) -> list[str]:
        raw = drug_pool or self.simulator.drugs
        resolved = []
        for drug in raw:
            feature = self.simulator.resolve_drug(drug)
            if feature not in resolved:
                resolved.append(feature)
        return resolved

    def _choose_random(self, available: list[str], tested: set[str]) -> str:
        choices = [drug for drug in available if drug not in tested]
        if not choices:
            raise ValueError("No untested drugs remain")
        return self.rng.choice(choices)

    def _choose_drug(
        self,
        request: EpisodeRequest,
        available: list[str],
        tested: set[str],
    ) -> tuple[str, str]:
        choices = [drug for drug in available if drug not in tested]
        if not choices:
            raise ValueError("No untested drugs remain")
        if request.policy == "random":
            return self.rng.choice(choices), "Random baseline pick from the available drug pool."

        scored = [
            (self._policy_score(request.policy, request.components, drug), drug)
            for drug in choices
        ]
        _, drug = max(scored, key=lambda item: item[0])
        why = {
            "greedy": "Lowest predicted mixed-tumor response among untested drugs.",
            "uncertainty": "Largest response spread across subclones among untested drugs.",
            "active_learner": "Best model signal: low ensemble mean response plus uncertainty bonus.",
        }[request.policy]
        return drug, why

    def _policy_score(
        self,
        policy: str,
        components: list[TumorComponent],
        drug: str,
    ) -> float:
        result = self.simulator.simulate_drug(components, drug)
        responses = [
            item["response"]
            for item in result["subclone_responses"]
            if item["response"] is not None
        ]
        uncertainty = statistics.pstdev(responses) if len(responses) > 1 else 0.0
        greedy = -result["mixed_response"]
        if policy == "greedy":
            return greedy
        if policy == "uncertainty":
            return uncertainty
        if policy == "active_learner" and self.predictions is not None:
            mixture = [(c.cell_line, c.proportion) for c in components]
            mean_pred, std_pred = self.predictions.mixed_tumor_stats(mixture, drug)
            if mean_pred is not None and std_pred is not None:
                return (-mean_pred) + (UNCERTAINTY_BONUS * std_pred)
        return greedy + (UNCERTAINTY_BONUS * uncertainty)

    def _final_recommendation(self, best_step: dict, goal: str) -> dict[str, str]:
        resistant = best_step["resistant_subclones"]
        if resistant:
            realization = f"{best_step['compound']} had the best mixed response, but {', '.join(resistant)} stayed resistant."
        else:
            realization = f"{best_step['compound']} had the strongest mixed response without a resistant subclone flag."
        return {
            "recommended_compound": best_step["compound"],
            "main_realization": realization,
            "next_experiment": f"Use this {goal} run to prioritize a follow-up around {best_step['compound']}.",
            "active_vs_random": "Random baseline completed without retesting a compound.",
        }


def _self_check() -> None:
    env = FolkloreEnvironment(seed=3)
    components = [
        TumorComponent("BR:MCF7", 0.45),
        TumorComponent("BR:T-47D", 0.35),
        TumorComponent("BR:MDA-MB-231", 0.2),
    ]
    request = EpisodeRequest("Breast heterogeneous", components, budget=6, policy="random")
    rollout = env.run_episode(request)
    compounds = [step["compound"] for step in rollout["steps"]]
    assert len(rollout["steps"]) == 6
    assert len(compounds) == len(set(compounds))
    assert rollout["final"]["recommended_compound"]
    for policy in ("greedy", "uncertainty", "active_learner"):
        policy_rollout = env.run_episode(
            EpisodeRequest("Breast heterogeneous", components, budget=6, policy=policy)
        )
        policy_compounds = [step["compound"] for step in policy_rollout["steps"]]
        assert len(policy_compounds) == len(set(policy_compounds))
        assert policy_rollout["steps"][0]["why_chosen"] != rollout["steps"][0]["why_chosen"]
    print("folklore environment self-check passed")


if __name__ == "__main__":
    _self_check()

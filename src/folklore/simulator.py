"""Ground-truth mixed-tumor drug response simulator."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .mechanisms import display_mechanism

ROOT = Path(__file__).resolve().parents[2]
LANDMARK_DIR = ROOT / "processed_data" / "clean" / "drug_landmarks"
MATRIX_PATH = LANDMARK_DIR / "drug_activity_landmark_matrix.csv"
METADATA_PATH = LANDMARK_DIR / "drug_activity_landmark_metadata.csv"
SAMPLE_INFO_PATH = ROOT / "processed_data" / "sample_info.csv"

SENSITIVE_THRESHOLD = -1.0
RESISTANT_THRESHOLD = 0.0


@dataclass(frozen=True)
class TumorComponent:
    cell_line: str
    proportion: float


class FolkloreSimulator:
    def __init__(
        self,
        matrix_path: Path = MATRIX_PATH,
        metadata_path: Path = METADATA_PATH,
        sample_info_path: Path = SAMPLE_INFO_PATH,
    ) -> None:
        self.matrix = pd.read_csv(matrix_path, index_col="cell_line")
        self.metadata = pd.read_csv(metadata_path)
        self.sample_info = pd.read_csv(sample_info_path).set_index("cell_line")
        self._feature_by_name = {
            str(row.drug_name).lower(): row.clean_feature_name
            for row in self.metadata.itertuples()
        }

    @property
    def cell_lines(self) -> list[str]:
        return self.matrix.index.tolist()

    @property
    def drugs(self) -> list[str]:
        return self.matrix.columns.tolist()

    def drug_info(self, drug: str) -> dict[str, str]:
        feature = self.resolve_drug(drug)
        row = self.metadata[self.metadata["clean_feature_name"] == feature]
        if row.empty:
            return {
                "id": feature,
                "name": feature,
                "mechanism": display_mechanism(feature, "unknown"),
            }
        first = row.iloc[0]
        feature = str(first.get("clean_feature_name") or feature)
        raw = str(first.get("mechanism") or first.get("category") or "unknown")
        return {
            "id": feature,
            "name": str(first.get("drug_name") or feature),
            "mechanism": display_mechanism(feature, raw),
        }

    def resolve_drug(self, drug: str) -> str:
        if drug in self.matrix.columns:
            return drug
        by_name = self._feature_by_name.get(drug.lower())
        if by_name in self.matrix.columns:
            return by_name
        raise ValueError(f"Unknown drug: {drug}")

    def simulate_drug(
        self,
        components: list[TumorComponent] | list[dict],
        drug: str,
    ) -> dict:
        normalized = self._normalize_components(components)
        feature = self.resolve_drug(drug)
        info = self.drug_info(feature)

        weighted = 0.0
        observed_weight = 0.0
        subclone_responses = []
        for component in normalized:
            raw = self.matrix.at[component.cell_line, feature]
            response = None if pd.isna(raw) else float(raw)
            if response is not None:
                weighted += component.proportion * response
                observed_weight += component.proportion
            subclone_responses.append(
                {
                    "cell_line": component.cell_line,
                    "proportion": component.proportion,
                    "response": None if response is None else round(response, 4),
                    "label": "missing" if response is None else label_response(response),
                    "cancer_type": self._cancer_type(component.cell_line),
                }
            )

        if observed_weight <= 0:
            raise ValueError(f"No observed responses for {feature} on this tumor")

        mixed_response = weighted / observed_weight
        resistant_subclones = [
            item["cell_line"]
            for item in subclone_responses
            if item["label"] == "resistant"
        ]

        return {
            "compound": info["name"],
            "compound_id": feature,
            "mechanism": info["mechanism"],
            "mixed_response": round(mixed_response, 4),
            "subclone_responses": subclone_responses,
            "has_resistant_subclone": bool(resistant_subclones),
            "resistant_subclones": resistant_subclones,
        }

    def _normalize_components(
        self,
        components: list[TumorComponent] | list[dict],
    ) -> list[TumorComponent]:
        normalized = [
            c if isinstance(c, TumorComponent) else TumorComponent(**c)
            for c in components
        ]
        if not 2 <= len(normalized) <= 4:
            raise ValueError("Tumor must have 2-4 subclones")
        for component in normalized:
            if component.cell_line not in self.matrix.index:
                raise ValueError(f"Unknown cell line: {component.cell_line}")
            if component.proportion <= 0:
                raise ValueError("Component proportions must be positive")
        total = sum(c.proportion for c in normalized)
        if total <= 0:
            raise ValueError("Component proportions must sum above zero")
        return [
            TumorComponent(c.cell_line, c.proportion / total)
            for c in normalized
        ]

    def _cancer_type(self, cell_line: str) -> str | None:
        if cell_line not in self.sample_info.index:
            return None
        value = self.sample_info.at[cell_line, "cancer_type"]
        return None if pd.isna(value) else str(value)


def label_response(response: float) -> str:
    if response <= SENSITIVE_THRESHOLD:
        return "sensitive"
    if response >= RESISTANT_THRESHOLD:
        return "resistant"
    return "intermediate"


def _self_check() -> None:
    sim = FolkloreSimulator()
    components = [
        TumorComponent("BR:MCF7", 0.5),
        TumorComponent("BR:T-47D", 0.3),
        TumorComponent("BR:MDA-MB-231", 0.2),
    ]
    drug = "NSC_673596_7_Ethyl_10_hydroxycamptothecin"
    result = sim.simulate_drug(components, drug)
    expected = (0.5 * 0.78) + (0.3 * 0.71) + (0.2 * -1.61)
    assert abs(result["mixed_response"] - round(expected, 4)) < 1e-9
    assert result["compound"] == "7-Ethyl-10-hydroxycamptothecin"
    assert result["subclone_responses"][2]["label"] == "sensitive"
    assert sim.simulate_drug(components, "7-Ethyl-10-hydroxycamptothecin")["compound_id"] == drug
    print("folklore simulator self-check passed")


if __name__ == "__main__":
    _self_check()

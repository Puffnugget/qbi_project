"""Human-readable mechanism labels for timeline and catalog UI."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OVERRIDES_PATH = ROOT / "processed_data" / "clean" / "drug_landmarks" / "mechanism_overrides.json"


@lru_cache(maxsize=1)
def _load_overrides() -> dict[str, str]:
    if not OVERRIDES_PATH.exists():
        return {}
    return json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))


def display_mechanism(feature_id: str, raw: str | None) -> str:
    """Map raw metadata mechanism strings to short display labels."""
    overrides = _load_overrides()
    if feature_id in overrides:
        return overrides[feature_id]
    if not raw or raw in {"-", "unknown", "nan"}:
        return "Unknown mechanism"
    text = str(raw).strip()
    if text.startswith("PK:"):
        target = text.removeprefix("PK:").replace("_", " ")
        return f"{target} inhibitor"
    if "|" in text:
        parts = [display_mechanism(feature_id, p) for p in text.split("|")]
        return " / ".join(dict.fromkeys(parts))
    return text.replace("_", " ")

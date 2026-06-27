"""Build data/processed/sample_info.csv from the transposed metadata file."""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METADATA = ROOT / "processed_data" / "transposed" / "cell_line_metadata_transposed.csv"
OUT = ROOT / "data" / "processed" / "sample_info.csv"

# Map full tissue names from CellMiner to the short cancer type labels used in the frontend
TISSUE_MAP = {
    "Breast": "Breast",
    "Central nervous system": "CNS",
    "Colon": "Colon",
    "Leukemia": "Leukemia",
    "Melanoma": "Melanoma",
    "Non-Small Cell Lung": "Lung",
    "Ovarian": "Ovarian",
    "Prostate": "Prostate",
    "Renal": "Renal",
}


def build_sample_info() -> None:
    with open(METADATA, newline="") as f:
        rows = list(csv.reader(f))

    # Row structure after transposition:
    #   rows[0]  → header: ['cell_line', 'V2', 'V3', ...]
    #   rows[1]  → ['Cell Line Name', 'BR:MCF7', 'BR:MDA_MB_231', ...]
    #   rows[2]  → ['tissue of origin a', 'Breast', 'Breast', ...]
    cell_line_row = next(r for r in rows if r[0] == "Cell Line Name")
    tissue_row = next(r for r in rows if r[0] == "tissue of origin a")

    cell_lines = cell_line_row[1:]
    tissues = tissue_row[1:]

    assert len(cell_lines) == len(tissues), "Row length mismatch in metadata"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["cell_line", "cancer_type"])
        for cl, tissue in zip(cell_lines, tissues):
            cancer_type = TISSUE_MAP.get(tissue, tissue)
            writer.writerow([cl, cancer_type])

    print(f"Wrote {len(cell_lines)} cell lines → {OUT}")


if __name__ == "__main__":
    build_sample_info()

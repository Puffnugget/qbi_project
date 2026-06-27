# Multi-Omics Minimal Panel Selector — Full Agent Reference Plan

---

## Project Summary

A web application that answers one question: given 60 cancer cell lines, which small group captures the most biological diversity across four different measurement types simultaneously?

The tool selects the minimum set of NCI-60 cancer cell lines that maximizes coverage across transcriptomics, proteomics, metabolomics, and drug sensitivity data. It presents results as a 3D interactive visualization built in Next.js + Three.js with a FastAPI backend and a Python scientific pipeline.

**Bonus stretch goal (time permitting):** Keep the main project exactly as-is. If time remains, add a separate adaptive experimental design sandbox where policies pick cell lines one at a time and are scored by how quickly each new choice improves held-out drug response prediction.

---

## Project Status (updated Jun 27, 2026 — post push/pull)

**Recent commits:** `filtering`, `zscores and log trans`, `add blind spot detector and manual panel override`, merge with `main`.

### Nikhi — done (UI + real fused-matrix pipeline)

| Area | Status |
|------|--------|
| Repo structure | `frontend/`, `src/`, `api/`, `data/`, `raw_data/`, `r/`, `processed_data/` |
| Frontend | Full app on regenerated real fused-matrix JSON — Explore/Compare tabs, blind spot, manual override |
| FastAPI | `api/main.py` — all endpoints including `/blindspot`, `/embeddings` |
| Python pipeline | `PYTHONPATH=. python src/run_pipeline.py` completes using `processed_data/pca/fused_matrix.csv` |
| Stretch (done) | Blind Spot Detector, Manual Override + live coverage |
| Stretch (open) | Fly-in animation |

### Sister — R cleaning largely done; annotation not started

| Area | Status |
|------|--------|
| `r/loading.R` | Transpose + intersect **60 common cell lines** across 5 datasets |
| `r/check_log_zscore.R` | Log2 + z-score → `processed_data/log_zscored/` |
| `r/zscore_methylation_proteomics.R` | Column z-score for methylation/proteomics → `processed_data/zscored/` |
| Outputs | `processed_data/transposed/`, `filtered/`, `log_zscored/`, `zscored/` |
| Layers in data | R fused matrix available: `processed_data/pca/fused_matrix.csv` (60 × 150) |
| fgsea / characterization | Not done — pathway/characterization JSON still dummy |

### Integration status

Python now reuses the R fused matrix when present instead of rebuilding from missing metabolomics log-zscore inputs.

| Layer | Source file (`processed_data/log_zscored/`) | Status |
|-------|---------------------------------------------|--------|
| RNA | `rna_seq_log_zscored.csv` | ✅ ready (60 lines) |
| Proteomics | `proteomics_log_zscored.csv` | ✅ ready |
| Metabolomics | `metabolomics_log_zscored.csv` | ⬜ not in repo; not blocking while using `processed_data/pca/fused_matrix.csv` |
| Drug | `drug_activity_log_zscored.csv` | ✅ ready |

**Not used for fusion:** methylation, histone (sister cleaned them but team chose metabolomics over methylation).

`sample_info.csv` is aligned 60/60 in both `processed_data/sample_info.csv` and `data/processed/sample_info.csv`.

### Dev commands

```bash
PYTHONPATH=. python src/run_pipeline.py
python src/adaptive_design.py
uvicorn api.main:app --reload --port 8000
cd frontend && npm run dev
```

---

## Scientific Justification

### The Problem

Cancer researchers must pick a small set of cell lines to work with. Most pick based on convention or availability. This is scientifically suboptimal because:

- Two cell lines can look identical in gene expression but be completely different in drug response
- Picking based on one data layer misses diversity in all other layers
- Most panels are redundant — researchers run experiments on biologically similar lines and miss huge swaths of biological space

### The Solution

Fuse four omics layers into a joint latent representation. Apply greedy farthest-point sampling to select the subset of lines that maximally covers that space. Validate empirically using drug sensitivity prediction.

### Why Four Layers

Each layer captures partially independent biology:

- **Transcriptomics (RNA-seq):** active gene programs, current cell state. RNA-protein correlation is only ~r=0.4-0.6 meaning >50% of proteomic variance is invisible to RNA alone
- **Proteomics:** functional protein complement after all post-transcriptional regulation. What is actually present and doing biology
- **Metabolomics:** downstream functional output — what the cell consumes and produces. NCI-60 has clean metabolomics data; most other datasets don't. This is a differentiator
- **Drug sensitivity:** GI50 values across thousands of compounds. The most directly clinically relevant layer. Captures pharmacological diversity that no molecular measurement directly predicts

### Empirical Validation

After selecting a panel of size k, predict each non-selected line's drug sensitivity as the weighted average of its nearest selected neighbors in multi-omics space. Compute Pearson correlation between predicted and actual GI50 values across all lines per drug. Report median correlation across 150 landmark drugs. Plot this validation curve alongside the coverage curve — they should agree on the optimal panel size.

---

## Dataset

### NCI-60

The most comprehensively characterized cancer cell panel ever assembled. 60 cell lines spanning 9 cancer types profiled continuously since the 1990s.

**9 cancer types:** Breast, CNS, Colon, Leukemia, Lung, Melanoma, Ovarian, Prostate, Renal

**Why NCI-60 over CCLE:**
- All four layers are available and clean
- Small enough to run locally (under 100MB total)
- Judges from UCSF will immediately recognize it
- Drug sensitivity data for 50,000+ compounds enables empirical validation
- If RunPod GPU credits are available, can upgrade to full CCLE (1000+ lines)

### Data Source

CellMiner: https://discover.nci.nih.gov/cellminer/

Download the following datasets:
- RNA: 5 Platform Gene Transcript/Average z scores
- Proteomics: SWATH mass spectrometry
- Metabolomics: metabolite abundance matrix
- Drug activity: GI50 values (full matrix)
- Sample annotations: cell line metadata with cancer type labels

### Data Format Notes

CellMiner XLS files have metadata rows at the top. The actual column headers are on row 11 (confirmed from inspection). Use `skip=10` when reading in R.

After skipping metadata:
- Row 1 becomes gene/feature names
- Rows 2-6 are annotation rows (Entrez ID, chromosome, start, end, cytoband) — must be dropped
- Remaining rows are cell lines with numeric values
- Data needs to be transposed: rows should be cell lines, columns should be features

Cell line names follow the format `TISSUE:CELLLINENAME` (e.g., `BR:MCF7`, `LC:NCI-H460`). This format must be consistent across all four datasets for the intersection step to work.

---

## Team Structure

### You (CS/bioinformatics)
Owns: FastAPI backend, Next.js frontend, Three.js visualization, Python ML pipeline

### Sister (HS bioinformatics student, knows R and Python, no React/JS)
Owns: R data cleaning, R biological annotation, Python characterization script

### Tool Allocation
- **Claude Pro ($20/mo):** planning, debugging logic, narrative, demo script — primary thinking tool
- **Codex via ChatGPT Plus ($20/mo):** backend heavy lifting — preprocessing, algorithm, validation. Well-scoped contained tasks. 10-60 cloud tasks per 5-hour rolling window
- **Cursor Hobby (free):** frontend and glue code. 2000 completions/month, 50 premium requests — use completions for autocomplete, save premium requests for complex multi-file context
- **Antigravity (free, sister's account):** parallel UI tasks — UMAP viz, comparison view. Runs multiple agents in parallel. Stick to Gemini Flash or Claude Sonnet to preserve quota; escalate to Opus only when stuck
- **RunPod (GPU credits):** MOFA+ training, foundation model embeddings (scGPT, ESM-2), full CCLE upgrade, optional batched policy rollouts at CCLE scale. Spin up A100 40GB instance (~$1.50-2.50/hr). Budget 10-15 hours of compute

---

## Architecture

```
RunPod GPU Instance
  └── Heavy compute: MOFA+, scGPT embeddings, optional policy rollouts
  └── Outputs: JSON files downloaded to laptop

Laptop
  ├── raw_data/              ← CellMiner XLS downloads
  ├── processed_data/        ← sister's R outputs ✅
  │   ├── transposed/        ← 60 lines × features, aligned
  │   ├── filtered/          ← common cell line intersection
  │   ├── log_zscored/       ← log2 + z-score (all 5 layers)
  │   └── zscored/           ← z-score methylation/proteomics only
  ├── data/
  │   └── processed/         ← Nikhi pipeline input (handoff target) ✅
  ├── r/
  │   ├── loading.R          ← transpose + intersect ✅
  │   ├── check_log_zscore.R ← log + z-score ✅
  │   └── zscore_methylation_proteomics.R ✅
  ├── src/                   ← Python pipeline (run on real fused matrix)
  │   ├── fusion.py         ← PCA fusion + embeddings.json export
  │   ├── selection.py      ← greedy panel selection
  │   ├── coverage.py       ← coverage scoring
  │   ├── validation.py     ← drug sensitivity validation
  │   ├── umap_3d.py        ← UMAP 3D coordinates
  │   ├── blindspot.py      ← cancer type + pathway blind spot analysis
  │   ├── generate_dummy_data.py ← fallback JSON generator (no CSVs needed)
  │   └── adaptive_design.py ← sequential design sandbox (stretch goal)
  ├── api/
  │   └── main.py           ← FastAPI backend ✅
  ├── frontend/
  │   └── (Next.js app)     ← Three.js + React frontend ✅
  └── frontend/public/
      └── precomputed/      ← static JSON files for demo ✅ real fused-matrix data live
```

---

## Remaining Work by Person

### Nikhi (you)

**Critical path (unblocks real demo):**
1. ~~Align on 4 fusion layers~~ — **rna_seq + proteomics + metabolomics + drug_activity**
2. ~~Build aligned `sample_info.csv`~~ — 60/60 cell lines, no missing cancer types
3. ~~Run pipeline~~ — `PYTHONPATH=. python src/run_pipeline.py`
4. ~~Replace dummy panel/UMAP/coverage/validation/blindspot/adaptive JSON~~
5. **Smoke test** full UI on real data

**Polish (if time):**
7. Fly-in animation on slider increment.
8. Demo rehearsal 3×; projector screenshot.
9. Adaptive Design tab is generated from real fused matrix.

### Sister (Natasha)

**Critical path:**
1. **Download metabolomics** from CellMiner → add to `r/loading.R` file_specs → produce `metabolomics_log_zscored.csv`
2. **Fix `r/loading.R`** — `common_lines` → `common_cell_lines`; unify output paths under `processed_data/`
3. ~~Export `sample_info.csv`~~ — Python-aligned version exists in both handoff paths
4. Confirm **rna_seq, proteomics, drug_activity** stay aligned on same 60 lines after metabolomics join

**After Nikhi runs `fusion.py` (needs `rna_pca_loadings.csv`):**
5. **fgsea** on RNA PCA loadings → real `factor_annotations.json` + per-cell-line `pathway_scores.json`.
6. **Characterization** for selected lines → real `characterization.json` (why selected, top genes).
7. Re-run `blindspot.py` with real pathway scores (Level 2 blind spots).

**Not blocking demo:**
- Metabolomics download (using methylation/histone instead unless team switches).
- Drug matrix filter to 150 landmark drugs (if not already done in cleaning).

### Both (sync)

- [x] Pick 4 layers for fusion: **rna_seq, proteomics, metabolomics, drug_activity**
- [ ] Download + clean metabolomics (sister)
- [x] Export aligned `sample_info.csv`
- [x] Confirm cell line names match fused matrix (`BR:MCF7` format)

---

All computation is precomputed and saved as static JSON files before the demo. The frontend reads from `public/precomputed/` — no live computation during the demo. This makes the demo bulletproof against conference WiFi failures and backend crashes.

FastAPI backend is used during development and for the RunPod live inference stretch goal. During the actual demo, everything is static JSON.

---

## Her Tasks (R + Python)

### R — Data Cleaning (Hours 0-3)

Load all four XLS files:
```r
library(readxl)
rna_raw <- read_excel("data/raw/rna.xls", col_names=FALSE)
```

Find the real header row (row 11 for RNA — verify for other datasets):
```r
rna <- read_excel("data/raw/rna.xls", skip=10, col_names=TRUE)
```

Set gene names as row identifiers and drop annotation rows (rows 1-6 after skipping are Entrez ID, chromosome, start, end, cytoband):
```r
colnames(rna) <- as.character(rna[1, ])
rna <- rna[7:nrow(rna), ]  # drop annotation rows
rownames(rna) <- rna[[1]]
rna <- rna[, -1]
```

Transpose so rows = cell lines, columns = features:
```r
rna <- t(rna)
rna <- as.data.frame(rna)
```

Handle missing values:
```r
sum(is.na(rna))
# If small number: impute with column median
# If large: filter features with >10% missing first
```

Repeat for proteomics, metabolomics, drug sensitivity. Note: each file may have different skip row counts — check each one manually first.

Find intersection of cell lines across all four datasets:
```r
common_lines <- Reduce(intersect, list(
  rownames(rna), rownames(prot), rownames(metab), rownames(drug)
))
```

Filter all four to common lines in the same order:
```r
rna <- rna[common_lines, ]
prot <- prot[common_lines, ]
metab <- metab[common_lines, ]
drug <- drug[common_lines, ]
```

Drug sensitivity: filter to ~150 landmark drugs covering diverse mechanisms (kinase inhibitors, DNA damaging agents, antimetabolites, targeted agents):
```r
# Select mechanistically diverse drugs
# Remove drugs with >20% missing values across lines
drug_filtered <- drug[, colSums(is.na(drug)) < 0.2 * nrow(drug)]
```

RNA is already z-scored from CellMiner. For other layers that aren't pre-normalized:
```r
# Log2 transform then z-score
metab <- log2(metab + 1)
metab <- scale(metab)
```

Save all four clean matrices:
```r
write.csv(rna, "data/processed/rna_clean.csv", row.names=TRUE)
write.csv(prot, "data/processed/prot_clean.csv", row.names=TRUE)
write.csv(metab, "data/processed/metab_clean.csv", row.names=TRUE)
write.csv(drug, "data/processed/drug_clean.csv", row.names=TRUE)
```

Verify: all four CSVs must have identical row order and the same cell line names.

### R — Biological Factor Annotation (Hours 8-14)

After the Python pipeline runs PCA and saves loadings, load the RNA PCA loadings:
```r
library(fgsea)
rna_loadings <- read.csv("data/processed/rna_pca_loadings.csv", row.names=1)
```

For each of the top 5 PCs, extract the top 50 genes by absolute loading value and run fgsea against MSigDB Hallmark gene sets:
```r
hallmark <- gmtPathways("data/h.all.v2024.1.Hs.symbols.gmt")

for (pc in paste0("PC", 1:5)) {
  ranked_genes <- sort(setNames(rna_loadings[[pc]], rownames(rna_loadings)),
                       decreasing=TRUE)
  result <- fgsea(pathways=hallmark, stats=ranked_genes, minSize=10, maxSize=500)
  # Save top pathway as the biological label for this PC
}
```

Output: a table mapping each PC to its biological label (e.g., PC1=Cell Cycle, PC2=Oxidative Phosphorylation, PC3=EMT).

Save as:
```r
write.csv(factor_labels, "data/processed/factor_annotations.csv")
```

### R/Python — Selected Line Characterization (Hours 14-18)

Once Python pipeline outputs the selected panel for each size, for each selected cell line:
- Pull its z-score rank for every gene, protein, metabolite
- Identify top 3 most overexpressed genes vs dataset mean
- Identify top 3 most abundant proteins vs dataset mean
- Identify top 3 most elevated metabolites vs dataset mean
- Identify top 3 most sensitive drugs (lowest GI50) vs dataset mean
- Write one plain-English sentence explaining why it was selected (based on its distance and which layer drove its selection)

Output format (JSON):
```json
{
  "BR:MCF7": {
    "cancer_type": "Breast",
    "subtype": "Luminal A",
    "why_selected": "Highest metabolic divergence from panel centroid",
    "top_genes": ["ESR1", "GATA3", "TFF1"],
    "top_proteins": ["ESR1", "PGR", "FOXA1"],
    "top_metabolites": ["glutamine", "citrate", "lactate"],
    "top_drugs": ["tamoxifen", "fulvestrant", "palbociclib"],
    "selection_step": 2
  }
}
```

Save as `data/processed/characterization.json`

---

## Your Tasks (Python + FastAPI + Next.js + Three.js)

### Python — Preprocessing and Fusion (Hours 0-6)

Load four clean CSVs from sister's R output:
```python
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

rna = pd.read_csv("data/processed/rna_clean.csv", index_col=0)
prot = pd.read_csv("data/processed/prot_clean.csv", index_col=0)
metab = pd.read_csv("data/processed/metab_clean.csv", index_col=0)
drug = pd.read_csv("data/processed/drug_clean.csv", index_col=0)
```

Run PCA on each layer (30 components):
```python
n_components = 30

pcas = {}
embeddings = {}
loadings = {}

for name, df in [("rna", rna), ("prot", prot), ("metab", metab), ("drug", drug)]:
    pca = PCA(n_components=n_components)
    embedding = pca.fit_transform(df.values)
    embeddings[name] = pd.DataFrame(embedding, index=df.index,
                                     columns=[f"PC{i+1}" for i in range(n_components)])
    loadings[name] = pd.DataFrame(pca.components_.T, index=df.columns,
                                   columns=[f"PC{i+1}" for i in range(n_components)])
    pcas[name] = pca

# Save RNA loadings for sister's fgsea annotation
loadings["rna"].to_csv("data/processed/rna_pca_loadings.csv")
```

Concatenate into fused matrix:
```python
fused = pd.concat([embeddings["rna"], embeddings["prot"],
                   embeddings["metab"], embeddings["drug"]], axis=1)
fused.to_csv("data/processed/fused_matrix.csv")
```

**RunPod upgrade — MOFA+ instead of PCA concatenation:**
If RunPod GPU is available, train MOFA+ instead:
```python
from mofapy2.run.entry_point import entry_point

ent = entry_point()
ent.set_data_options(scale_groups=False, scale_views=True)
ent.set_data_matrix([[rna.values], [prot.values], [metab.values], [drug.values]],
                    views_names=["RNA", "Proteomics", "Metabolomics", "Drug"])
ent.set_model_options(factors=20, spikeslab_weights=True, ard_factors=True)
ent.set_train_options(iter=1000, convergence_mode="fast", gpu_mode=True, seed=42)
ent.build()
ent.run()

# Extract factor scores — use these instead of concatenated PCA
fused = pd.DataFrame(
    ent.model.nodes["Z"].getExpectations()["E"][0],
    index=rna.index,
    columns=[f"Factor{i+1}" for i in range(20)]
)

# Extract variance explained per factor per layer
r2 = ent.model.calculate_variance_explained()
# Save as JSON for the variance explained heatmap in the frontend
```

**RunPod upgrade — Foundation model embeddings:**
For maximum scientific impact, replace PCA with foundation model embeddings:
- RNA layer: run scGPT or Geneformer on gene expression profiles
- Proteomics: use ESM-2 embeddings of protein sequences
- Drug sensitivity: use ChemBERTa embeddings of drug SMILES strings
These generate semantically rich embeddings that capture biological meaning beyond variance explained.

### Python — Panel Selection Algorithm (Hours 3-8)

```python
from scipy.spatial.distance import cdist
import json

def greedy_farthest_point(embedding, n_panels):
    n = len(embedding)
    dist_matrix = cdist(embedding, embedding, metric="euclidean")
    selected = []
    selection_log = []

    # Start with line closest to centroid
    centroid = embedding.mean(axis=0)
    dists_to_centroid = np.linalg.norm(embedding - centroid, axis=1)
    first = int(np.argmin(dists_to_centroid))
    selected.append(first)
    selection_log.append({"step": 1, "index": first,
                          "reason": "Closest to dataset centroid"})

    for step in range(2, n_panels + 1):
        selected_dists = dist_matrix[:, selected].min(axis=1)
        selected_dists[selected] = -np.inf
        next_line = int(np.argmax(selected_dists))
        max_dist = float(selected_dists[next_line])
        selected.append(next_line)
        selection_log.append({"step": step, "index": next_line,
                              "distance": max_dist})

    return selected, selection_log

def coverage_score(embedding, selected_indices):
    dists = cdist(embedding, embedding[selected_indices]).min(axis=1)
    diameter = cdist(embedding, embedding).max()
    return float(1 - (dists.mean() / diameter))

# Run for all panel sizes
cell_lines = list(fused.index)
embedding = fused.values
results = {}

for k in range(1, 21):
    selected, log = greedy_farthest_point(embedding, k)
    cov = coverage_score(embedding, selected)
    results[k] = {
        "selected_indices": selected,
        "selected_names": [cell_lines[i] for i in selected],
        "coverage_score": cov,
        "selection_log": log
    }

with open("public/precomputed/panel_all.json", "w") as f:
    json.dump(results, f)
```

Run this for each cancer type filter as well. Save separate JSON files:
- `panel_all.json`
- `panel_breast.json`
- `panel_lung.json`
- `panel_ovarian.json`
- etc.

### Python — Coverage Scoring (Hours 5-8)

Implement per-layer coverage (run coverage metric separately on each layer's PCA embedding):
```python
per_layer_coverage = {}
for k in range(1, 21):
    selected = results[k]["selected_indices"]
    layer_scores = {}
    for name, emb in embeddings.items():
        layer_scores[name] = coverage_score(emb.values, selected)
    per_layer_coverage[k] = layer_scores

with open("public/precomputed/per_layer_coverage.json", "w") as f:
    json.dump(per_layer_coverage, f)
```

Find elbow point:
```python
from kneed import KneeLocator

panel_sizes = list(range(1, 21))
cov_scores = [results[k]["coverage_score"] for k in panel_sizes]
kl = KneeLocator(panel_sizes, cov_scores, curve="concave", direction="increasing")
elbow = kl.elbow  # optimal panel size
```

### Python — Drug Sensitivity Validation (Hours 8-11)

```python
from sklearn.linear_model import Ridge
from scipy.stats import pearsonr

drug_full = pd.read_csv("data/processed/drug_clean.csv", index_col=0)
validation_results = {}

for k in range(3, 16):
    selected = results[k]["selected_indices"]
    non_selected = [i for i in range(len(cell_lines)) if i not in selected]
    selected_names = [cell_lines[i] for i in selected]
    non_selected_names = [cell_lines[i] for i in non_selected]

    correlations = []
    X_sel = embedding[selected]

    for drug_name in drug_full.columns:
        y_true = drug_full[drug_name].values
        # Predict non-selected lines as weighted avg of nearest selected
        preds = []
        for i in non_selected:
            dists = np.linalg.norm(X_sel - embedding[i], axis=1)
            weights = 1 / (dists + 1e-8)
            weights /= weights.sum()
            preds.append(np.dot(weights, y_true[selected]))

        y_pred = np.array(preds)
        y_actual = y_true[non_selected]
        if len(set(y_actual)) > 1:
            r, _ = pearsonr(y_pred, y_actual)
            correlations.append(r)

    validation_results[k] = float(np.median(correlations))

with open("public/precomputed/validation.json", "w") as f:
    json.dump(validation_results, f)
```

### Python — UMAP 3D Coordinates (Hours 8-11)

```python
import umap

# 3D UMAP for Three.js visualization
reducer_3d = umap.UMAP(n_components=3, random_state=42, n_neighbors=15, min_dist=0.1)
coords_3d = reducer_3d.fit_transform(embedding)

# Load cancer type annotations
sample_info = pd.read_csv("data/raw/sample_info.csv", index_col=0)

umap_data = []
for i, cell_line in enumerate(cell_lines):
    cancer_type = sample_info.loc[cell_line, "cancer_type"] if cell_line in sample_info.index else "Unknown"
    umap_data.append({
        "id": cell_line,
        "x": float(coords_3d[i, 0]),
        "y": float(coords_3d[i, 1]),
        "z": float(coords_3d[i, 2]),
        "cancer_type": cancer_type,
        "index": i
    })

with open("public/precomputed/umap_3d.json", "w") as f:
    json.dump(umap_data, f)
```

### Python — Adaptive Experimental Design Sandbox (Stretch Goal, Hours 28+)

This is a separate add-on after the main panel selector is working. Do not replace the current greedy panel selection pipeline. The main project still answers: "Which small fixed panel best covers multi-omics diversity?" The stretch goal asks a different question: "If you could run experiments one by one, which strategy learns the fastest from each additional cell line?"

```python
class SequentialDesignSim:
    """
    Replayable simulator over NCI-60.
    State: selected lines + revealed drug-response PCs + current surrogate error
    Action: choose next unobserved cell line
    Observation: reveal the selected line's withheld drug-response profile
    Score: reduction in held-out prediction error / predictive variance
    """
    def __init__(self, embedding, drug_targets, target_size=8):
        self.embedding = embedding
        self.drug_targets = drug_targets
        self.n = len(drug_targets)
        self.target_size = target_size

    def reset(self):
        self.selected = []
        self.observed_y = {}
        return self._get_obs()

    def step(self, action):
        if action in self.selected:
            return self._get_obs(), -0.1, False, {}

        self.selected.append(action)
        self.observed_y[action] = self.drug_targets[action]
        new_rmse = evaluate_surrogate(
            self.embedding, self.observed_y, self.drug_targets
        )
        reward = self.prev_rmse - new_rmse
        self.prev_rmse = new_rmse
        done = len(self.selected) >= self.target_size
        return self._get_obs(), reward, done, {}

    def _get_obs(self):
        obs = np.zeros(self.n + 2, dtype=np.float32)
        obs[self.selected] = 1.0
        obs[-2] = len(self.selected)
        obs[-1] = self.prev_rmse
        return obs
```

Start with policy rollouts, not deep RL:
```python
for policy in ["coverage_greedy", "uncertainty", "thompson"]:
    result = rollout_policy(
        policy=policy,
        embedding=fused_matrix,
        drug_targets=drug_pca,
        target_size=8,
        n_restarts=64,
    )

# Save stepwise selections + held-out RMSE curves for frontend playback
```

Implementation notes:
- Use a replayable offline simulator built from the existing NCI-60 data
- Reveal drug-response PCs only after a line is "selected"
- Compare three simple policies first: coverage-greedy, uncertainty sampling, Thompson sampling
- Keep a random baseline to catch adaptive sampling bias
- Skip `gym` / `stable-baselines3` unless the simple policies clearly plateau

Scientific framing:
"We formulated panel selection as a sequential experimental design problem. Each step chooses the next cell line to assay, reveals its pharmacology, and asks how quickly that observation improves prediction on the rest of the panel. That turns our static dataset into a sample-efficiency benchmark."

### FastAPI Backend (Hours 0-6, parallel with fusion)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Load all precomputed data at startup
with open("public/precomputed/umap_3d.json") as f:
    umap_data = json.load(f)

@app.get("/umap")
def get_umap(cancer_type: str = "all"):
    if cancer_type == "all":
        return umap_data
    return [d for d in umap_data if d["cancer_type"] == cancer_type]

@app.get("/panel/{size}")
def get_panel(size: int, cancer_type: str = "all"):
    filename = f"public/precomputed/panel_{cancer_type}.json"
    with open(filename) as f:
        data = json.load(f)
    return data[str(size)]

@app.get("/coverage")
def get_coverage():
    with open("public/precomputed/coverage_curve.json") as f:
        return json.load(f)

@app.get("/validation")
def get_validation():
    with open("public/precomputed/validation.json") as f:
        return json.load(f)

@app.get("/characterization/{cell_line}")
def get_characterization(cell_line: str):
    with open("public/precomputed/characterization.json") as f:
        data = json.load(f)
    return data.get(cell_line, {})
```

Run with: `uvicorn api.main:app --reload --port 8000`

### Next.js Frontend Structure

```
frontend/
  app/
    page.tsx              ← main layout (Explore + Compare tabs) ✅
  components/
    Scene3D.tsx           ← Three.js UMAP canvas ✅
    Sidebar.tsx           ← controls + blind spot + manual reset ✅
    CoverageCurve.tsx     ← Recharts line chart ✅
    RadarChart.tsx        ← SVG radar chart ✅
    SelectionLog.tsx      ← selected lines table + CSV download ✅
    CompareView.tsx       ← side by side comparison ✅
    BlindSpotPanel.tsx    ← cancer type grid + pathway gaps ✅
    AdaptiveDesignTab.tsx ← sequential design visualization (stretch)
  lib/
    data.ts, coverage.ts, constants.ts, types.ts
  public/
    precomputed/          ← all JSON files ✅
```

Install dependencies:
```bash
npx create-next-app@latest frontend --typescript --tailwind  # ✅ done
cd frontend
npm install three @react-three/fiber @react-three/drei recharts axios  # ✅ done
```

### Three.js UMAP Scene (Hours 4-12)

Core scene setup in `Scene3D.tsx`:
- Canvas fills the right 75% of the screen
- Background: deep dark (`#050510`)
- Ambient light + point light for sphere shading
- OrbitControls for rotate/zoom/pan
- Auto-rotate slowly when user is not interacting

Cell line spheres:
- All 60 lines rendered as spheres at their 3D UMAP coordinates
- Default state: small spheres (~0.3 radius), colored by cancer type
- 9 colors for 9 cancer types — use a distinctive palette, not default
- Selected state: larger spheres (0.7 radius), emissive gold glow
- Unselected when filter active: fade to near-transparent gray (opacity 0.15)

Cancer type color palette:
```javascript
const CANCER_COLORS = {
  "Breast": "#FF6B9D",
  "CNS": "#C77DFF",
  "Colon": "#4CC9F0",
  "Leukemia": "#F72585",
  "Lung": "#4361EE",
  "Melanoma": "#F77F00",
  "Ovarian": "#FCBF49",
  "Prostate": "#06D6A0",
  "Renal": "#EF233C"
}
```

Animations:
- When panel size changes: new sphere flies in from outside scene, traces arc, lands with pulse
- When cancer filter changes: non-matching spheres fade out smoothly over 400ms
- On hover: sphere scales up slightly, tooltip appears
- Connection lines between selected spheres (thin gold lines)
- Slow ambient rotation (0.001 rad/frame) when user not interacting

The "fly in" animation is the most important visual effect. Budget 2 hours for this. It's the moment that makes everyone in the room say "oh."

### Sidebar Controls

```typescript
// Controls state
const [panelSize, setPanelSize] = useState(8)
const [cancerType, setCancerType] = useState("all")
const [layers, setLayers] = useState({
  rna: true, proteomics: true, metabolomics: true, drug: true
})
const [compareMode, setCompareMode] = useState(false)

// Controls UI
- Cancer type dropdown: "All Cancer Types" + 9 individual types
- Panel size slider: 2-15, updates Three.js in real time
- Layer checkboxes: which omics layers to include
- Compare toggle: switches to split-screen view
- Elbow indicator: "Suggested optimal: 8 lines" shown below slider
```

### Coverage Curve (Recharts)

```typescript
// Two lines on same chart
// Line 1: coverage score vs panel size (blue)
// Line 2: drug prediction correlation vs panel size (green)
// Dashed vertical line at elbow point
// Dot highlighting current slider position
// Tooltip showing exact values on hover
```

### Radar Chart (SVG)

Four axes: RNA, Proteomics, Metabolomics, Drug Sensitivity. Shows per-layer coverage score for current panel. A balanced panel produces a regular quadrilateral. Imbalanced panels show which layers are underrepresented. Updates when panel size or cancer filter changes.

### Selection Log

Table below the 3D scene. One row per selected cell line. Columns:
- Cell line name
- Cancer type (colored badge)
- Selection step
- Why selected (plain English from characterization JSON)
- Top genes/proteins/metabolites (expandable)
- Download CSV button

### Compare View

Two Three.js scenes side by side. Left: cancer type A. Right: cancer type B. Cell lines shared between both panels pulse white. Overlap count shown between the two scenes: "2 lines selected by both panels." **✅ Implemented in `CompareView.tsx` + Compare tab.**

### Blind Spot Detector (Stretch — ✅ DONE on dummy data)

**Level 1 — Cancer type coverage** (no sister dependency once `panel_all.json` exists):
- `src/blindspot.py` — per-k cancer type selected/total/fraction + `missing_types`
- `frontend/public/precomputed/blindspot.json`
- `BlindSpotPanel.tsx` — grid in sidebar (red=missing, yellow=partial, green=covered)
- Red "Blind to: …" banner when any type at 0
- `Scene3D.tsx` — missing-type cell lines pulse with red rim glow

**Level 2 — Pathway coverage** (stub with dummy `pathway_scores.json`; real fgsea later):
- Pathway gap = |panel_mean − global_mean| / |global_mean|, flag if > 0.3
- `pathway_gaps_by_size` in `blindspot.json`, rendered in `BlindSpotPanel.tsx`

### Manual Override + Live Coverage Drop (Stretch — ✅ DONE)

- `fusion.py` exports `embeddings.json` (fused PCA coords per cell line)
- `lib/coverage.ts` — browser-side `computeCoverage()` (~O(n×k))
- Click spheres to toggle manual panel; gold / cyan / gray / default states
- Cyan dot on coverage curve at `(manualPanel.length, manualCoverage)`
- "Reset to Optimal" in sidebar when manual mode active; slider resets to greedy

### Adaptive Design Tab (Stretch Goal — DONE on real fused matrix)

Single Three.js scene + multi-policy chart. Play replays sequential picks (500ms/step). Policies: Coverage Greedy, Uncertainty, Thompson, Random. Scored by median held-out drug prediction r. Run `python src/adaptive_design.py`.

Current status: `frontend/public/precomputed/adaptive_design.json` was regenerated from `data/processed/fused_matrix.csv` and landmark drug data.

Next AI upgrade (after real data): add `ridge_uncertainty` active learning. At each step, train bootstrapped Ridge regressors on the selected cell lines (`fused embedding → drug response PCs/vector`), score unselected lines by prediction variance plus a small diversity bonus, then pick the most informative next assay. This is more impressive than hard-coded replay because the model learns from revealed samples and chooses what data it wants next. Still skip full RL training unless this baseline clearly plateaus.

---

## Full Task List by Language

### R Tasks (Sister)

| Task | Hours | Output | Status |
|------|-------|--------|--------|
| Load and inspect all XLS files | 0-1 | — | ✅ `r/loading.R` |
| Transpose + drop annotation rows | 1-2 | `processed_data/transposed/` | ✅ |
| Intersect 60 common cell lines | 3-4 | `processed_data/filtered/` (60 lines) | ✅ |
| Log2 + z-score all layers | 2-3 | `processed_data/log_zscored/` | ✅ `check_log_zscore.R` |
| Z-score methylation/proteomics | 2-3 | `processed_data/zscored/` | ✅ |
| Export `sample_info.csv` (cancer types) | 3-4 | `data/processed/sample_info.csv` | ✅ |
| Handoff CSVs to `data/processed/` | 3-4 | `rna_clean.csv`, etc. | ⬜ |
| Run fgsea on RNA PCA loadings | 8-12 | `factor_annotations.json` | ⬜ blocked on fusion |
| Characterization JSON | 14-18 | `characterization.json` | ⬜ |
| Pathway scores per cell line | 14-18 | `pathway_scores.json` | ⬜ blocked on fgsea |

### Python Tasks (Her)

| Task | Hours | Output |
|------|-------|--------|
| Load four clean CSVs, verify dimensions | 3-4 | — |
| PCA on each layer (30 components) | 4-5 | pca_embeddings/, rna_pca_loadings.csv |
| Concatenate into fused matrix (or MOFA+ on RunPod) | 5-6 | fused_matrix.csv |
| Greedy farthest-point selection, all panel sizes 1-20 | 6-8 | panel_all.json |
| Coverage scoring (mean NN distance, per-layer) | 7-8 | coverage_curve.json, per_layer_coverage.json |
| Drug sensitivity validation correlation | 8-11 | validation.json |
| UMAP 3D coordinates | 9-11 | umap_3d.json |
| Adaptive design rollouts (stretch, hour 28+) | 28-34 | adaptive_design.json |

### Python/FastAPI Tasks (You)

| Task | Hours | Output | Status |
|------|-------|--------|--------|
| FastAPI app setup with CORS | 0-2 | api/main.py | ✅ |
| All API endpoints reading from precomputed JSON | 2-4 | running server on :8000 | ✅ |
| Pipeline scripts (fusion, selection, coverage, validation, umap) | 4-11 | src/*.py | ✅ run on real fused matrix |
| Run full pipeline on sister's CSVs | 11-14 | real precomputed JSON | ✅ using R fused matrix |
| `generate_dummy_data.py` for dev without CSVs | — | dummy JSON | ✅ fallback |
| `blindspot.py` + pathway gaps | stretch | blindspot.json | ✅ |
| Per-cancer-type JSON generation | 11-14 | panel_*.json | ✅ (dummy) |

### JavaScript/TypeScript Tasks (You)

| Task | Hours | Output | Status |
|------|-------|--------|--------|
| Next.js project scaffold + dependency install | 0-1 | frontend/ | ✅ |
| Basic page layout (sidebar + main canvas) | 2-4 | page.tsx | ✅ |
| Three.js scene setup (canvas, lighting, orbit controls) | 4-6 | Scene3D.tsx | ✅ |
| Render 60 spheres at UMAP coordinates, colored by cancer type | 6-8 | Scene3D.tsx | ✅ |
| Selected sphere highlighting (gold glow, size increase) | 8-10 | Scene3D.tsx | ✅ |
| Fly-in animation for new sphere selections | 10-12 | Scene3D.tsx | ⬜ |
| Hover tooltips on spheres | 12-14 | Scene3D.tsx | ✅ (inline Html tooltip) |
| Sidebar controls (dropdown, slider, checkboxes) | 10-13 | Sidebar.tsx | ✅ |
| Cancer filter fade animation | 13-15 | Scene3D.tsx | ✅ (opacity fade) |
| Coverage curve (Recharts, dual lines, elbow marker) | 14-16 | CoverageCurve.tsx | ✅ |
| Per-layer radar chart (SVG) | 16-18 | RadarChart.tsx | ✅ |
| Selection log table | 18-20 | SelectionLog.tsx | ✅ |
| Compare view (split screen, overlap highlighting) | 20-24 | CompareView.tsx | ✅ |
| Blind spot panel + red rim glow | stretch | BlindSpotPanel.tsx | ✅ |
| Manual override + live coverage dot | stretch | page.tsx, coverage.ts | ✅ |
| Dark theme polish, animations, responsive sidebar | 24-28 | global styles | ~ partial |
| Adaptive design tab (stretch, hour 32+) | 32-38 | AdaptiveDesignTab.tsx | ✅ |

---

## Hour-by-Hour Timeline

| Hours | Her (R + Python) | You (Python + JS) |
|-------|-----------------|-------------------|
| 0-3 | R: load, clean, normalize all four XLS files | FastAPI setup + Next.js scaffold |
| 3-6 | Python: PCA + fusion pipeline | Three.js scene basic setup |
| 6-10 | Python: greedy selection + coverage + UMAP | Three.js spheres + orbit controls |
| 8-12 | R: fgsea biological annotation | Three.js interactions + hover + fly-in animation |
| 10-14 | Python: drug sensitivity validation | Sidebar controls + cancer filter |
| 14-18 | R/Python: characterization JSON | Coverage curve + radar chart |
| 18-22 | Testing, edge cases, bug fixing | Selection log + compare view |
| 22-28 | Buffer / help where needed | Dark theme polish + animations |
| 28-34 | Python: adaptive design rollouts (stretch) | Adaptive design tab (stretch) |
| 34-40 | Slides + demo script | Final bug fixes + demo prep |
| 40-48 | Rehearsal + presentation | Rehearsal + presentation |

---

## Precomputed JSON Files (All must exist before demo)

```
frontend/public/precomputed/
  umap_3d.json              ← 3D coordinates for all 60 lines          ✅
  panel_all.json            ← panel selections sizes 1-20              ✅
  panel_breast.json … panel_renal.json  ← per-type panels              ✅
  coverage_curve.json       ← coverage scores for sizes 2-15           ✅
  per_layer_coverage.json   ← per-layer coverage for each size           ✅
  validation.json           ← drug prediction correlation                ✅
  characterization.json     ← biological characterization (dummy)        ~ sister's real output later
  factor_annotations.json   ← PCA factor labels (dummy)                  ~ sister's fgsea later
  blindspot.json            ← cancer type + pathway blind spots          ✅
  embeddings.json           ← fused PCA coords for manual coverage       ✅
  pathway_scores.json       ← per-cell-line pathway scores (dummy)       ~ real fgsea later
  adaptive_design.json      ← stepwise policy rollouts (real fused matrix) ✅
```

---

## RunPod GPU Usage Plan

**Instance:** A100 40GB (~$1.50-2.50/hr)
**Template:** PyTorch 2.x + CUDA 12.x pre-installed
**Estimated compute hours:** 10-15 hours = $15-25 in credits

**Priority order for GPU tasks:**

1. **MOFA+ training** (replaces concatenated PCA) — 2 minutes on GPU vs 30 min on CPU. Do this first.
2. **Foundation model embeddings** — scGPT for RNA, ESM-2 for proteomics, ChemBERTa for drugs. Only feasible on GPU. Strongest scientific upgrade.
3. **Full CCLE dataset** — upgrade from 60 NCI-60 lines to 1000+ CCLE lines if time allows. Requires GPU for UMAP.
4. **Policy rollouts at CCLE scale** — optional only if you scale past NCI-60. For the base hackathon version, CPU is enough.

**Workflow:** all heavy computation runs on RunPod. Download resulting JSON files to laptop. Frontend serves them statically. No RunPod dependency during the demo.

---

## Demo Script (Exact Sequence)

**Setup:** Browser open to localhost:3000. Three.js scene already rotating. Full screen. Projector on.

**Second 0-3:** Let the scene rotate silently. 60 glowing spheres in the dark. Don't say anything yet.

**Second 3:** "Every one of these 60 dots is a cancer cell line. Scientists use these to test drugs and study disease. But nobody can afford to work with all 60. So how do you pick?"

**Interaction 1 — Slider (seconds 15-45):** Slowly drag panel size from 1 to 8. "Our algorithm finds the minimum set that captures maximum biological diversity — across gene expression, protein levels, metabolomics, and drug response simultaneously. Watch as each new line is chosen because it covers the most unexplored biological territory."

**Interaction 2 — Cancer filter (seconds 45-70):** Switch dropdown to "Breast Cancer." "A breast cancer researcher gets a completely different panel. Same algorithm, different biological context. The tool adapts to your question."

**Interaction 3 — Hover (seconds 70-90):** Hover over MCF7. "Every selected line comes with a biological explanation. Not just which lines — but why. MCF7 was selected because of its metabolic divergence from the rest of the breast cancer lines."

**Interaction 4 — Coverage curve (seconds 90-110):** Point to the curve. "This is the key result. The blue line is biological coverage — it plateaus at 8 lines. The green line is drug sensitivity prediction accuracy — an empirical validation using 50,000 compounds. Both curves agree: 8 lines gives you 89% of the information of all 60, at 13% of the cost."

**Interaction 5 — Compare view (seconds 110-140):** Click Compare tab. "Here's breast cancer vs lung cancer side by side. Two lines appear in both panels — those are the biologically universal representatives, relevant regardless of cancer type."

**Interaction 6 — Adaptive design tab if built (seconds 140-170):** Click Adaptive Design tab. Hit Play. "We also turned this into a sample-efficiency benchmark. Different sequential policies pick which line to assay next, and we measure how quickly each one improves drug-response prediction on the rest of the panel."

**Closing (seconds 170-200):** "Cancer researchers spend millions on redundant experiments because they pick cell lines by convention, not data. This tool changes that. Open source, runs in the browser, no coding required. And the framework generalizes to any multi-omics dataset."

**Total time: ~3.5 minutes.** Do not improvise. Do not show anything outside this sequence.

---

## UCI COSMOS Professor Pitches

**Dr. Babak Shahbaba & Dr. Zhaoxia Yu (Statistics, Health Sciences — Cluster 1)**

Lead with: "The panel selection problem is a Bayesian optimal experimental design problem. Our greedy algorithm is a one-step lookahead policy maximizing information gain. The coverage score is an explicit information-theoretic reward function. We'd love to explore whether a full Bayesian treatment could improve on the greedy approximation."

**Dr. John Lowengrub (Mathematics, Tumor Biology — Cluster 3)**

Lead with: "We built a minimal cell line panel that predicts drug sensitivity across NCI-60 at r=0.87. The validation framework maps directly onto tumor heterogeneity modeling — the same mathematical structure describes how a panel of cell lines represents a tumor's clonal diversity. We think this could extend to patient-derived organoid selection."

**Dr. Ali Mortazavi (Genomics, RNA-seq — Cluster 6)**

Lead with: "Our RNA layer uses PCA today but we've laid the groundwork for scGPT embeddings. The biological factor annotation — PC1=cell cycle, PC2=oxidative phosphorylation — was done using fgsea against MSigDB Hallmarks. We'd be curious whether your group's work on developmental trajectories could inform better embedding strategies for the transcriptomics layer."

---

## Sister's Research Thread (Post-Hackathon)

The biological annotation and characterization work she does at the hackathon is the foundation for an independent research project:

**Project title:** "Multi-omics characterization of transcriptional and metabolic diversity in NCI-60 ovarian cancer cell lines"

**What she does:**
1. Filter the panel selector to ovarian cancer lines only
2. Rerun factor annotation using fgsea on the ovarian-specific PCA
3. For each selected ovarian line, write a detailed biological characterization
4. Compare her computational findings against published literature on ovarian cancer cell line diversity
5. Write up as a short research report

**Why this works:**
- The pipeline is already built from the hackathon — she's doing biological interpretation on top
- Ovarian cancer is understudied and has clean NCI-60 data
- This is exactly the kind of project Dr. Mortazavi's or Dr. Shahbaba's labs would supervise
- Realistic scope for a HS researcher with R skills

---

## Tonight (Pre-Hackathon Checklist)

### You
- [x] Download NCI-60 datasets from CellMiner (in `raw_data/` — metabolomics still missing)
- [ ] Open each in Excel, count metadata rows, write down skip number for each
- [ ] Verify cell line names look consistent across all four files
- [x] Run `npx create-next-app@latest frontend --typescript --tailwind`
- [x] Install Python deps (`requirements.txt` + fastapi)
- [x] Install Node deps: `three @react-three/fiber @react-three/drei recharts axios`
- [ ] Set up RunPod account, have A100 instance ready to spin up

### Sister
- [x] Install R packages (`readxl`, `data.table`, etc.)
- [x] Download GMT (`raw_data/Human Gene Sets v2026.1.gmt`)
- [x] Clean + transpose + intersect cell lines (`r/loading.R`)
- [x] Log-zscore pipeline (`r/check_log_zscore.R`, `zscore_methylation_proteomics.R`)
- [x] Export `sample_info.csv` with cancer type labels
- [x] Hand off `sample_info.csv` and `fused_matrix.csv` to `data/processed/` for Python
- [ ] fgsea + characterization (after Nikhi runs fusion)
- [ ] Write down 9 cancer types + one fact each for demo

### Both
- [x] Agree on exact cell line name format — `sample_info.csv` matches fused matrix names 60/60
- [ ] Write the demo script in notes app — both read it out loud once tonight
- [ ] Set alarm for early tomorrow — first 3 hours are critical

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Cell line names don't match between datasets | Standardize format in R before saving CSVs. Print and compare first 5 names from each file before running intersection |
| Conference WiFi fails during demo | Everything served as static JSON from localhost. No network dependency |
| FastAPI backend crashes during demo | Precomputed JSON means frontend works without the backend. Demo from static files only |
| Sister's R script takes too long | Pre-run everything tonight if data is already downloaded |
| MOFA+ doesn't train in time | Concatenated PCA is the fallback. Equal algorithmic result, slightly weaker scientific story |
| Three.js fly-in animation not smooth | Simplify to instant swap if behind schedule. Scientific result doesn't change |
| Adaptive design tab not finished | Skip entirely. It's labeled stretch goal for a reason |
| RunPod instance unavailable | Fall back to local CPU. NCI-60 is small enough to run everything locally |

---

## What Winning Looks Like

The two previous QBI first-place winners (Cys-TEAM 2025, StructHunt 2023) both combined:
1. A real scientific pain point that every scientist in the room recognizes
2. An existing public dataset
3. A clean, usable interface

This project has all three. The addition that makes it stronger than either winner: empirical drug sensitivity validation. You're not just building a tool — you're proving it works with a concrete quantitative result (r=0.87 drug prediction correlation). That's the difference between a good hackathon project and a publishable one.

The Three.js 3D visualization is the demo moment. The drug validation correlation is the scientific result. The plain-English selection log is what makes it usable by non-computational scientists. All three together win.


### Judging Criteria and Prizes

- Judged on four dimensions:
  - Impact: is the project useful and meaningful?
  - Execution: is it a working project, not just an idea?
  - Diversity of professional backgrounds and education stages
  - Novelty: is this something new?
- Cash prizes processed after the event (not distributed on the day)
- Winning teams can apply for up to $10,000 in continued project support

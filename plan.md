# Multi-Omics Minimal Panel Selector — Pivoted Master Plan

**Archive of pre-pivot plan:** `archive/plan-pre-pivot-2026-06-27.md`

This file keeps the useful technical detail from the original plan, but the active direction is now narrower.

## The Pivot

The original plan had too many active branches at once: main demo, research upgrades, GPU scaling, adaptive-design exploration, and long implementation notes.

**Active pivot:** this is now a **judge-optimized, static-demo-safe NCI-60 decision-support product**.

The project should win on:

1. a real scientific pain point
2. a working interface
3. a quantitative validation result
4. a clean, believable team split

Anything that does not improve that outcome before judging is no longer on the critical path.

## What We Are Optimizing For

### 1. Impact

- Make the problem instantly legible: labs choose redundant cell lines by convention.
- Make the output useful to a cancer researcher, not just visually interesting.

### 2. Execution

- The demo must work locally.
- The core flow must survive backend failure and WiFi failure.
- The main path must be understandable in under 30 seconds.

### 3. Novelty

- Core novelty: multi-omics panel selection.
- Credibility layer: held-out drug-response validation.

### 4. Presentation clarity

- The biology contribution and engineering contribution both need to show.
- Optional features must stay optional.

---

## Project Summary

A web application that answers one question: given 60 cancer cell lines, which small group captures the most biological diversity across four different measurement types simultaneously?

The tool selects the minimum set of NCI-60 cancer cell lines that maximizes coverage across transcriptomics, proteomics, metabolomics, and drug sensitivity data. It presents results as a 3D interactive visualization built in Next.js + Three.js with a FastAPI backend and a Python scientific pipeline.

**Active framing:** the core story is fixed-panel selection plus empirical validation. Adaptive design and other extras are only shown if the main path is already stable.

---

## Project Status (updated Jun 27, 2026 — post push/pull)

**Recent commits:** `filtering`, `zscores and log trans`, blind spot + manual override, beige/forest-green theme, 3D scene polish, fly-in animation, ridge validation, user filters, custom data analysis tab, protein expression lookup, adaptive design chart fixes, 5-layer R PCA fusion.

### Nikhi — done (UI + real fused-matrix pipeline + polish)

| Area | Status |
|------|--------|
| Repo structure | `frontend/`, `src/`, `api/`, `data/`, `raw_data/`, `r/`, `processed_data/` |
| Frontend | Full app on real fused-matrix JSON — Explore / Compare / Adaptive design / **Analyze Your Data** tabs |
| UI theme | Light beige + forest green (`globals.css` CSS vars); dark forest `#162920` 3D scene background |
| Animations | **Fly-in** on slider increment (drop-from-above + easeOutBack + landing pulse in `Scene3D.tsx`); **staggered reveal** on sidebar/charts (`reveal` / `reveal-delay-*` in `globals.css`); cancer-filter fade; red rim pulse on blind spots; compare-view overlap pulse |
| FastAPI | `api/main.py` — core endpoints + `/custom-panel`, `/filter-options`, custom upload + protein search via `api/custom_analysis.py` |
| Python pipeline | `PYTHONPATH=. python src/run_pipeline.py` completes using `processed_data/pca/fused_matrix.csv` |
| Validation | Ridge regression on held-out drug response (`src/validation.py`) — replaces inverse-distance weighting |
| Customization | `src/customization.py` — filter by adherence, doubling time, BSL, cancer type, gender; per-layer weights |
| Stretch (done) | Blind Spot Detector, Manual Override + live coverage, Adaptive Design tab, Analyze Your Data + protein lookup |

### Sister — R cleaning + PCA fusion + fgsea/characterization — DONE

| Area | Status |
|------|--------|
| `r/loading.R` | Transpose + intersect **60 common cell lines** across datasets (incl. **metabolomics**) |
| `r/check_log_zscore.R` | Smart log2 + z-score (detects already-logged / already-z-scored data) → `processed_data/log_zscored/` |
| `r/zscore_methylation_proteomics.R` | Column z-score for methylation/proteomics → `processed_data/zscored/` |
| `r/filter_landmark_drugs.R` | Filters drug matrix to ~150 mechanistically diverse landmark compounds |
| `r/pca_analysis.R` | PCA (30 components) per layer → concatenated **fused matrix** |
| `r/biological_annotation.R` | Top genes/proteins/methylation features per PC from loadings |
| **Metabolomics** | ✅ Downloaded from CellMiner, cleaned, log-zscored → `metabolomics_log_zscored.csv` / `metabolomics_clean.csv` |
| **fgsea** | ✅ Hallmark pathway enrichment on RNA PCA loadings → `factor_annotations.json` |
| **Characterization** | ✅ Per-cell-line biological characterization → `characterization.json` |
| **Pathway scores** | ✅ Per-cell-line Hallmark pathway scores → `pathway_scores.json` (powers Level 2 blind spots) |
| Outputs | `processed_data/clean/`, `processed_data/pca/`, `processed_data/log_zscored/`, `processed_data/annotation/` |
| Fused matrix | `processed_data/pca/fused_matrix.csv` — **60 cell lines × 150 features** (30 PCs × 5 layers) |

### Data cleaning pipeline (what actually runs)

```text
raw_data/*.xls(x)
  → r/loading.R          transpose, drop annotation rows, intersect 60 cell lines
  → processed_data/filtered/
  → r/check_log_zscore.R log2 + z-score (skip if already transformed)
  → processed_data/log_zscored/
  → processed_data/clean/   per-layer clean CSVs
  → r/filter_landmark_drugs.R   150 landmark drugs + metadata
  → r/pca_analysis.R       30 PCs per layer → fused_matrix.csv (150 cols)
  → src/run_pipeline.py    UMAP, selection, coverage, ridge validation, blindspot → frontend/public/precomputed/
```

**Cell line format:** `TISSUE:CELLLINENAME` (e.g. `BR:MCF7`). `src/build_sample_info.py` maps CellMiner metadata → 9 cancer types for the frontend.

### Integration status

Python reuses the R fused matrix when present. All agreed layers cleaned and annotated.

| Layer | Clean file | Status |
|-------|-----------|--------|
| RNA-seq | `rna_seq_clean.csv` | ✅ |
| Proteomics | `proteomics_clean.csv` | ✅ |
| **Metabolomics** | `metabolomics_clean.csv` | ✅ downloaded + cleaned |
| Methylation | `methylation_clean.csv` | ✅ (in current 5-layer fused matrix) |
| Histone | `histone_clean.csv` | ✅ (in current 5-layer fused matrix) |
| Drug (150 landmarks) | `drug_activity_landmark_clean.csv` | ✅ |

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

### Active Scientific Claim

The project should defend one claim cleanly:

**A small multi-omics-selected panel can preserve most of the useful biological signal of the full NCI-60 collection, and we validate that claim using held-out drug-response prediction.**

### Empirical Validation

After selecting a panel of size k, predict each non-selected line's drug sensitivity as the weighted average of its nearest selected neighbors in multi-omics space. Compute Pearson correlation between predicted and actual GI50 values across all lines per drug. Report median correlation across 150 landmark drugs. Plot this validation curve alongside the coverage curve — they should agree on the optimal panel size.

---

## Dataset

### NCI-60

The most comprehensively characterized cancer cell panel ever assembled. 60 cell lines spanning 9 cancer types profiled continuously since the 1990s.

**9 cancer types:** Breast, CNS, Colon, Leukemia, Lung, Melanoma, Ovarian, Prostate, Renal

**Why NCI-60:**
- All four layers are available and clean
- Small enough to run locally (under 100MB total)
- Judges from UCSF will immediately recognize it
- Drug sensitivity data for 50,000+ compounds enables empirical validation

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

**Archived / not critical path now:** RunPod, MOFA+, foundation-model embeddings, CCLE scale-up. See archived plan if needed.

---

## Architecture

```text
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
  │   ├── fusion.py          ← PCA fusion + embeddings.json export
  │   ├── selection.py       ← greedy panel selection
  │   ├── coverage.py        ← coverage scoring
  │   ├── validation.py      ← drug sensitivity validation
  │   ├── umap_3d.py         ← UMAP 3D coordinates
  │   ├── blindspot.py       ← cancer type + pathway blind spot analysis
  │   ├── generate_dummy_data.py ← fallback JSON generator
  │   └── adaptive_design.py ← optional stretch playback
  ├── api/
  │   └── main.py            ← FastAPI backend ✅
  ├── frontend/
  │   └── (Next.js app)      ← Three.js + React frontend ✅
  └── frontend/public/
      └── precomputed/       ← static JSON files for demo ✅
```

---

## Remaining Work by Person

### Nikhi (you)

**Critical path:**
1. ~~Align on 4 fusion layers~~ — **rna_seq + proteomics + metabolomics + drug_activity**
2. ~~Build aligned `sample_info.csv`~~ — 60/60 cell lines, no missing cancer types
3. ~~Run pipeline~~ — `PYTHONPATH=. python src/run_pipeline.py`
4. ~~Replace dummy panel/UMAP/coverage/validation/blindspot/adaptive JSON~~
5. **Smoke test** full UI on real data
6. **Rehearse** demo 3× and do projector/fullscreen check

**Low-risk polish only after that:**
7. ~~Fly-in animation on slider increment.~~ ✅
8. ~~Staggered UI reveal + beige/forest-green theme.~~ ✅
9. ~~Adaptive Design tab on real fused matrix.~~ ✅
10. Wire `FilterControls.tsx` into main Explore sidebar only if it stays a small diff

### Sister (Natasha) — DONE / verify for demo

1. ~~Download metabolomics~~ ✅
2. ~~Fix `r/loading.R`~~ ✅
3. ~~Export `sample_info.csv`~~ ✅
4. ~~Confirm all layers aligned on same 60 lines after metabolomics join~~ ✅
5. ~~fgsea on RNA PCA loadings~~ ✅
6. ~~Characterization for selected lines~~ ✅
7. ~~Re-run blindspot with real pathway scores~~ ✅
8. Prepare 9 cancer-type facts + sanity-check the main selected-line explanations

### Both (sync)

- [x] Pick fusion layers
- [x] Download + clean metabolomics
- [x] Export aligned `sample_info.csv`
- [x] Confirm cell line names match fused matrix
- [x] R PCA pipeline → `processed_data/pca/fused_matrix.csv`
- [x] fgsea + characterization JSON → frontend `public/precomputed/`
- [x] Python pipeline regenerated all frontend JSON from real fused matrix
- [ ] Read the demo script out loud together
- [ ] Decide which optional screens get skipped first if timing gets tight

All computation is precomputed and saved as static JSON files before the demo. The frontend reads from `public/precomputed/` — no live computation during the demo. This makes the demo bulletproof against conference WiFi failures and backend crashes.

---

## Frontend Structure and Behavior

### Next.js Frontend Structure

```text
frontend/
  app/
    page.tsx               ← main layout (Explore + Compare tabs) ✅
  components/
    Scene3D.tsx            ← Three.js UMAP canvas + fly-in animation ✅
    Sidebar.tsx            ← controls + blind spot + manual reset ✅
    CoverageCurve.tsx      ← Recharts line chart ✅
    RadarChart.tsx         ← SVG radar chart ✅
    SelectionLog.tsx       ← selected lines table + CSV download ✅
    CompareView.tsx        ← side by side comparison ✅
    BlindSpotPanel.tsx     ← cancer type grid + pathway gaps ✅
    AdaptiveDesignTab.tsx  ← sequential design visualization ✅
    CustomDataAnalysis.tsx ← upload CSV + protein expression search ✅
    FilterControls.tsx     ← adherence/BSL/gender filters + layer weights (API-ready)
  lib/
    data.ts, coverage.ts, constants.ts, types.ts
  public/
    precomputed/           ← all JSON files ✅
```

### Three.js UMAP Scene

Core scene setup in `Scene3D.tsx`:
- Canvas fills the right 75% of the screen
- Background: dark forest `#162920`
- Ambient light + point light for sphere shading
- OrbitControls for rotate/zoom/pan
- Auto-rotate slowly when user is not interacting

Cell line spheres:
- All 60 lines rendered as spheres at their 3D UMAP coordinates
- Default state: small spheres, colored by cancer type
- Selected state: larger spheres, emissive gold glow
- Unselected when filter active: fade to near-transparent gray

Animations:
- Fly-in animation when panel size increases — **implemented**
- Cancer-filter fade — **implemented**
- Staggered reveal on page load — **implemented**
- Hover scale + tooltip — **implemented**
- Gold connection lines between selected spheres — **implemented**
- Red rim pulse on blind-spot cancer types — **implemented**

### Sidebar Controls

- Cancer type dropdown: all + 9 individual types
- Panel size slider: 2-15, updates Three.js in real time
- Layer checkboxes
- Compare toggle
- Elbow indicator for suggested optimal size

### Coverage Curve

- Blue line: coverage score vs panel size
- Green line: held-out drug prediction correlation
- Dashed elbow line
- Dot for current slider position
- Tooltip with exact values

### Radar Chart

Four axes: RNA, Proteomics, Metabolomics, Drug Sensitivity. Shows per-layer coverage score for current panel.

### Selection Log

One row per selected cell line:
- cell line name
- cancer type
- selection step
- why selected
- top genes/proteins/metabolites
- CSV download

### Compare View

Two Three.js scenes side by side. Shared lines pulse white. Overlap count shown between the two scenes.

### Blind Spot Detector

**Level 1 — Cancer type coverage**
- `src/blindspot.py`
- `frontend/public/precomputed/blindspot.json`
- `BlindSpotPanel.tsx`
- red banner when a type is missing

**Level 2 — Pathway coverage**
- powered by real `pathway_scores.json`
- pathway gaps rendered in `BlindSpotPanel.tsx`

### Manual Override + Live Coverage Drop

- `fusion.py` exports `embeddings.json`
- `lib/coverage.ts` computes browser-side coverage
- click spheres to toggle manual panel
- cyan manual-coverage dot on the chart
- reset-to-optimal control

### Optional Extras

- `AdaptiveDesignTab.tsx` exists and works on real fused matrix
- `CustomDataAnalysis.tsx` exists for upload + protein search
- `FilterControls.tsx` exists but is not yet wired into Explore

---

## Pipeline and Backend Details

### Python tasks and outputs

| Task | Output | Status |
|------|--------|--------|
| Fuse embeddings / reuse R fused matrix | `fused_matrix.csv`, `embeddings.json` | ✅ |
| Greedy panel selection | `panel_all.json`, per-type panel JSON | ✅ |
| Coverage scoring | `coverage_curve.json`, `per_layer_coverage.json` | ✅ |
| Drug validation | `validation.json` | ✅ Ridge |
| UMAP 3D projection | `umap_3d.json` | ✅ |
| Blind spot analysis | `blindspot.json` | ✅ |
| Adaptive design playback | `adaptive_design.json` | ✅ optional |

### FastAPI backend

`api/main.py` serves:
- `/umap`
- `/panel/{size}`
- `/coverage`
- `/validation`
- `/characterization/{cell_line}`
- `/filter-options`
- `/custom-panel`
- upload / analysis endpoints
- protein search endpoint

**Demo rule:** backend is useful for development and custom-analysis features, but the main judged flow should work from static JSON even if the backend is down.

---

## Precomputed JSON Files (must exist before demo)

```text
frontend/public/precomputed/
  umap_3d.json
  panel_all.json
  panel_breast.json … panel_renal.json
  coverage_curve.json
  per_layer_coverage.json
  validation.json
  characterization.json
  factor_annotations.json
  blindspot.json
  embeddings.json
  pathway_scores.json
  adaptive_design.json
  protein_expression.json
```

**Core demo-critical set:**
- `umap_3d.json`
- `panel_all.json`
- `coverage_curve.json`
- `per_layer_coverage.json`
- `validation.json`
- `blindspot.json`
- `embeddings.json`
- `pathway_scores.json`
- `characterization.json`
- `factor_annotations.json`

If these are intact, the demo is safe.

---

## Demo Script (Exact Sequence)

**Setup:** Browser open to localhost:3000. Three.js scene already rotating. Full screen. Projector on.

**Second 0-3:** Let the scene rotate silently.

**Second 3:** "Every one of these 60 dots is a cancer cell line. Scientists use these to test drugs and study disease. But nobody can afford to work with all 60. So how do you pick?"

**Interaction 1:** slider from 1 to 8.

**Interaction 2:** switch to Breast Cancer.

**Interaction 3:** hover a representative line like MCF7.

**Interaction 4:** point to coverage and validation curves.

**Interaction 5:** Compare tab.

**Interaction 6 only if time is good:** blind spot / adaptive design / analyze-your-data.

**Closing:** fewer redundant experiments, same biological information, validated by drug response.

**Rule:** do not depend on optional tabs to make the case.

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Cell line names don't match between datasets | Standardize format in R before saving CSVs |
| Conference WiFi fails during demo | Everything served as static JSON from localhost |
| FastAPI backend crashes during demo | Main flow reads precomputed JSON directly |
| Optional tab glitches | Skip it and stay on core flow |
| Story runs long | Stop after compare view |
| Projector performance issues | Drop to the simplest stable scene interactions |

---

## What Winning Looks Like

The project should feel strong on all four judging dimensions:

1. **Impact** — obvious scientific pain point
2. **Execution** — real working interface
3. **Novelty** — multi-omics + validation
4. **Team diversity** — clear bio + engineering collaboration

The most important sentence in the room is:

**We are not just visualizing the data; we are showing that a small, data-chosen panel preserves most of the useful information of all 60 lines, and we validate that claim with held-out drug response.**

The Three.js 3D visualization is the demo moment. The drug validation correlation is the scientific result. The plain-English selection log is what makes it usable by non-computational scientists.

### Judging Criteria and Prizes

- Judged on four dimensions:
  - Impact
  - Execution
  - Diversity of professional backgrounds and education stages
  - Novelty
- Cash prizes processed after the event
- Winning teams can apply for up to $10,000 in continued project support

---

## Archived Material

The following are intentionally removed from the active critical path and preserved only in the archive:

- RunPod GPU usage plan
- MOFA+ branch
- foundation model embedding branch
- CCLE scale-up branch
- longer professor-specific pitch branches
- post-hackathon research thread details
- full hour-by-hour speculative roadmap

If needed, use:

- `archive/plan-pre-pivot-2026-06-27.md`

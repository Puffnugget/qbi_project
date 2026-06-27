# Nikhi's Hackathon Execution Plan

> You own: Python pipeline + FastAPI + Next.js + Three.js
> Sister owns: R cleaning scripts + fgsea annotation + characterization JSON

---

## Current Status (updated Jun 27)

| Area | Status |
|------|--------|
| Raw data download | Mostly done — files in `raw_data/` (see Phase 0) |
| Python deps | Mostly installed — missing `fastapi` |
| Frontend scaffold | Done — Next.js 16 + all npm deps |
| Repo folder structure | Partial — `frontend/`, `raw_data/`, `r/` exist; no `src/`, `api/`, or `data/` yet |
| Python pipeline | Not started |
| FastAPI backend | Not started |
| Frontend UI | Layout + component stubs done; no JSON wiring yet |
| Sister R pipeline | Started — `r/loading.R` loads raw Excel files |

**Next up:** Create `data/processed/`, `src/`, `api/`; finish R cleaning → CSVs; run Python pipeline; wire frontend to `frontend/public/precomputed/`.

---

## Phase 0 — Setup (Do RIGHT NOW, 30 min)

- [x] Download NCI-60 datasets from CellMiner: https://discover.nci.nih.gov/cellminer/
  - [x] RNA: `raw_data/rna_seq.xls`
  - [x] Proteomics: `raw_data/proteomics.xls`
  - [x] Drug activity: `raw_data/drug_activity.xlsx`
  - [x] Cell line metadata: `raw_data/Cell Line Metadata.xls`
  - [x] Gene sets (for sister fgsea): `raw_data/Human Gene Sets v2026.1.gmt`
  - [ ] Metabolomics: metabolite abundance matrix — **not downloaded yet**
  - Note: also have `methylation.xls` and `histone.xlsx` (not in original plan — decide if used)
  - Files live in `raw_data/` (plan said `data/raw/` — align paths when pipeline starts)
- [~] Install Python deps:
  ```bash
  pip install fastapi uvicorn umap-learn scikit-learn kneed pandas numpy scipy
  ```
  - [x] uvicorn, umap-learn, scikit-learn, kneed, pandas, numpy, scipy
  - [ ] fastapi — still need to install
- [x] Scaffold frontend:
  ```bash
  npx create-next-app@latest frontend --typescript --tailwind
  cd frontend && npm install three @react-three/fiber @react-three/drei recharts axios
  ```
  - Also added: `lib/constants.ts`, `lib/types.ts`, dark theme, production build verified
- [~] Create folder structure:
  ```bash
  mkdir -p data/raw data/processed src api public/precomputed frontend
  ```
  - [x] `frontend/` + `frontend/public/precomputed/`
  - [x] `raw_data/` (actual data location)
  - [x] `r/` (sister's R scripts)
  - [ ] `data/raw`, `data/processed`, `src/`, `api/` at repo root

---

## Phase 1 — Python Pipeline (Hours 1-5)

**Blocked on sister's cleaned CSVs in `data/processed/`. Frontend scaffold is done — focus here next.**

### 1a. `src/fusion.py`
- Load `data/processed/rna_clean.csv`, `prot_clean.csv`, `metab_clean.csv`, `drug_clean.csv`
- PCA on each layer (30 components)
- Save RNA loadings → `data/processed/rna_pca_loadings.csv` (sister needs this for fgsea)
- Concatenate all 4 embeddings → `data/processed/fused_matrix.csv`

### 1b. `src/selection.py`
- Greedy farthest-point sampling on fused matrix
- Run for k = 1 to 20
- Run for ALL cancer types + each of 9 individual types
- Save:
  - `frontend/public/precomputed/panel_all.json`
  - `frontend/public/precomputed/panel_breast.json`, `panel_lung.json`, etc.

### 1c. `src/coverage.py`
- Coverage score = `1 - (mean_NN_dist / diameter)`
- Per-layer coverage (run separately on each layer's PCA)
- Find elbow with `kneed`
- Save:
  - `frontend/public/precomputed/coverage_curve.json`
  - `frontend/public/precomputed/per_layer_coverage.json`

### 1d. `src/validation.py`
- For k = 3 to 15: predict drug sensitivity of non-selected lines as weighted avg of nearest selected
- Pearson r per drug, take median across 150 drugs
- Save: `frontend/public/precomputed/validation.json`

### 1e. `src/umap_3d.py`
- 3D UMAP on fused matrix (n_components=3, random_state=42)
- Load cancer type labels from sample_info
- Save: `frontend/public/precomputed/umap_3d.json`

---

## Phase 2 — FastAPI Backend (Hours 2-4, parallel with pipeline)

**`api/main.py`** — spin this up early, even with dummy data

- `GET /umap?cancer_type=all`
- `GET /panel/{size}?cancer_type=all`
- `GET /coverage`
- `GET /validation`
- `GET /characterization/{cell_line}`
- Run: `uvicorn api.main:app --reload --port 8000`

---

## Phase 3 — Frontend (Hours 3-12, most of your time)

### 3a. Layout (Hour 3-4) — DONE
- [x] `frontend/app/page.tsx`: sidebar (25%) + main canvas (75%)
- [x] Dark background `#050510`
- [x] Sidebar: panel size slider (2-15), cancer type dropdown, layer checkboxes (`components/Sidebar.tsx`)

### 3b. Three.js Scene — `components/Scene3D.tsx` (Hours 4-8, HIGHEST PRIORITY) — IN PROGRESS
- [x] Canvas fills main area (dynamic import, SSR-safe)
- [ ] Load `umap_3d.json`, render 60 spheres at their coordinates
- [x] Color by cancer type (constants in `lib/constants.ts`):
  ```
  Breast:#FF6B9D  CNS:#C77DFF  Colon:#4CC9F0  Leukemia:#F72585
  Lung:#4361EE  Melanoma:#F77F00  Ovarian:#FCBF49  Prostate:#06D6A0  Renal:#EF233C
  ```
- [x] OrbitControls (rotate/zoom/pan)
- [x] Auto-rotate slowly when idle (when data loaded)
- [x] Placeholder state when no JSON yet

### 3c. Sphere Interactions (Hours 6-10) — NOT STARTED
- **Selected state:** larger sphere (0.7 radius), emissive gold `#FFD700`
- **Unselected when filtered:** fade to gray, opacity 0.15
- **On hover:** scale up slightly, show tooltip (cell line name + cancer type)
- **Gold connection lines** between all selected spheres
- **FLY-IN ANIMATION** (budget 2 hours, this is the "oh" moment):
  - When a new sphere is selected: it starts outside the scene, traces an arc, lands at its UMAP position with a pulse/ring effect
  - Trigger when slider increments

### 3d. Coverage Curve — `components/CoverageCurve.tsx` (Hour 10-11) — STUB DONE
- [x] Recharts component scaffold with dual-line chart structure
- [ ] Wire to `coverage_curve.json` + `validation.json`
- [ ] Line 1 (blue): coverage score vs panel size
- [ ] Line 2 (green): drug prediction correlation vs panel size
- [ ] Dashed vertical line at elbow point
- [ ] Dot highlighting current slider position

### 3e. Radar Chart — `components/RadarChart.tsx` (Hour 11-12) — NOT STARTED
- SVG, 4 axes: RNA, Proteomics, Metabolomics, Drug
- Shows per-layer coverage for current panel size
- Updates when slider moves

### 3f. Selection Log — `components/SelectionLog.tsx` (Hour 12-13) — NOT STARTED
- Table: cell line name | cancer type badge | selection step | why selected | top genes
- Loads from `characterization.json` (sister's output)
- Download CSV button

### 3g. Compare View — `components/CompareView.tsx` (Hour 14-16) — NOT STARTED
- Two Three.js scenes side by side
- Cancer type A vs cancer type B
- Shared lines pulse white
- Overlap count shown between scenes

---

## Phase 4 — Polish + Demo Prep (Hours 16-20)

- [~] Dark theme consistency across all components (base theme done; polish remaining components)
- [ ] Loading states while JSON fetches
- [~] Elbow indicator text: "Suggested optimal: 8 lines" below slider (placeholder text in Sidebar, needs real elbow from pipeline)
- [ ] Test the full demo sequence (see below) 3x
- [ ] Make sure everything works with backend OFF (static JSON only)
- [ ] Screenshot the app, make sure it looks good on projector

---

## Stretch Goal — RL Tab (Only if ahead of schedule)

`components/RLTab.tsx` + `src/rl_env.py`
- Don't touch this until Phase 3 is DONE

---

## Precomputed JSON Checklist

All must exist in `frontend/public/precomputed/` before demo:
- [ ] `umap_3d.json`
- [ ] `panel_all.json`
- [ ] `panel_breast.json` (+ lung, cns, colon, leukemia, melanoma, ovarian, prostate, renal)
- [ ] `coverage_curve.json`
- [ ] `per_layer_coverage.json`
- [ ] `validation.json`
- [ ] `characterization.json` ← sister's output
- [ ] `factor_annotations.json` ← sister's output

---

## Sister's R Pipeline (parallel track)

- [x] R project: `qbi_hackathon.Rproj`
- [~] `r/loading.R` — reads rna, methylation, proteomics, histone, drug from raw Excel (paths still point to `~/Desktop/qbi_hackathon/` — update to repo `raw_data/`)
- [ ] Export cleaned CSVs → `data/processed/rna_clean.csv`, etc.
- [ ] fgsea annotation → `factor_annotations.json`
- [ ] Characterization → `characterization.json`

---

## Demo Sequence (Memorize This)

1. **0-3s** — let the scene rotate silently. Say nothing.
2. **3s** — "Every dot is a cancer cell line. Scientists use these to test drugs. But nobody can afford to work with all 60. So how do you pick?"
3. **15-45s** — slowly drag slider from 1 → 8. Explain greedy selection.
4. **45-70s** — switch dropdown to Breast Cancer.
5. **70-90s** — hover over MCF7. Read the tooltip.
6. **90-110s** — point to coverage curve. "Blue = biological coverage. Green = drug prediction accuracy. Both agree: 8 lines = 89% of the information at 13% of the cost."
7. **110-140s** — click Compare tab. Show breast vs lung.
8. **170-200s** — "Cancer researchers spend millions on redundant experiments. This changes that."

**Total: ~3.5 minutes. Do not improvise.**

---

## If Things Break

| Problem | Fix |
|---------|-----|
| Sister's R script not done yet | Use dummy CSV with random values to test pipeline |
| Backend crashes | Switch frontend to read static JSON directly from `frontend/public/precomputed/` |
| Fly-in animation too slow | Simplify to instant highlight + pulse ring |
| UMAP looks bad | Adjust `n_neighbors` (try 5, 10, 30) and `min_dist` (try 0.05, 0.3) |
| Cell line names don't match | Print first 5 names from each CSV and manually align before intersection |
| R script paths wrong | Change `~/Desktop/qbi_hackathon/raw_data/` → repo-relative `raw_data/` |

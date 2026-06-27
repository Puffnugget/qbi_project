# Nikhi's Hackathon Execution Plan

> You own: Python pipeline + FastAPI + Next.js + Three.js
> Sister owns: R cleaning scripts + fgsea annotation + characterization JSON

---

## Phase 0 — Setup (Do RIGHT NOW, 30 min)

- [ ] Download all 4 NCI-60 datasets from CellMiner: https://discover.nci.nih.gov/cellminer/
  - RNA: "5 Platform Gene Transcript / Average z scores"
  - Proteomics: "SWATH mass spectrometry"
  - Metabolomics: metabolite abundance matrix
  - Drug activity: GI50 values (full matrix)
  - Put everything in `data/raw/`
- [ ] Install Python deps:
  ```bash
  pip install fastapi uvicorn umap-learn scikit-learn kneed pandas numpy scipy
  ```
- [ ] Scaffold frontend:
  ```bash
  npx create-next-app@latest frontend --typescript --tailwind
  cd frontend && npm install three @react-three/fiber @react-three/drei recharts axios
  ```
- [ ] Create folder structure:
  ```bash
  mkdir -p data/raw data/processed src api public/precomputed frontend
  ```

---

## Phase 1 — Python Pipeline (Hours 1-5)

**Do this while sister runs R cleaning. You need her CSVs before you can start, so start frontend scaffold in parallel.**

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
  - `public/precomputed/panel_all.json`
  - `public/precomputed/panel_breast.json`, `panel_lung.json`, etc.

### 1c. `src/coverage.py`
- Coverage score = `1 - (mean_NN_dist / diameter)`
- Per-layer coverage (run separately on each layer's PCA)
- Find elbow with `kneed`
- Save:
  - `public/precomputed/coverage_curve.json`
  - `public/precomputed/per_layer_coverage.json`

### 1d. `src/validation.py`
- For k = 3 to 15: predict drug sensitivity of non-selected lines as weighted avg of nearest selected
- Pearson r per drug, take median across 150 drugs
- Save: `public/precomputed/validation.json`

### 1e. `src/umap_3d.py`
- 3D UMAP on fused matrix (n_components=3, random_state=42)
- Load cancer type labels from sample_info
- Save: `public/precomputed/umap_3d.json`

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

### 3a. Layout (Hour 3-4)
- `app/page.tsx`: sidebar (25%) + main canvas (75%)
- Dark background `#050510`
- Sidebar: panel size slider (2-15), cancer type dropdown, layer checkboxes

### 3b. Three.js Scene — `components/Scene3D.tsx` (Hours 4-8, HIGHEST PRIORITY)
- Canvas fills 75% of screen
- Load `umap_3d.json`, render 60 spheres at their coordinates
- Color by cancer type:
  ```
  Breast:#FF6B9D  CNS:#C77DFF  Colon:#4CC9F0  Leukemia:#F72585
  Lung:#4361EE  Melanoma:#F77F00  Ovarian:#FCBF49  Prostate:#06D6A0  Renal:#EF233C
  ```
- OrbitControls (rotate/zoom/pan)
- Auto-rotate slowly when idle

### 3c. Sphere Interactions (Hours 6-10)
- **Selected state:** larger sphere (0.7 radius), emissive gold `#FFD700`
- **Unselected when filtered:** fade to gray, opacity 0.15
- **On hover:** scale up slightly, show tooltip (cell line name + cancer type)
- **Gold connection lines** between all selected spheres
- **FLY-IN ANIMATION** (budget 2 hours, this is the "oh" moment):
  - When a new sphere is selected: it starts outside the scene, traces an arc, lands at its UMAP position with a pulse/ring effect
  - Trigger when slider increments

### 3d. Coverage Curve — `components/CoverageCurve.tsx` (Hour 10-11)
- Recharts line chart
- Line 1 (blue): coverage score vs panel size
- Line 2 (green): drug prediction correlation vs panel size  
- Dashed vertical line at elbow point
- Dot highlighting current slider position

### 3e. Radar Chart — `components/RadarChart.tsx` (Hour 11-12)
- SVG, 4 axes: RNA, Proteomics, Metabolomics, Drug
- Shows per-layer coverage for current panel size
- Updates when slider moves

### 3f. Selection Log — `components/SelectionLog.tsx` (Hour 12-13)
- Table: cell line name | cancer type badge | selection step | why selected | top genes
- Loads from `characterization.json` (sister's output)
- Download CSV button

### 3g. Compare View — `components/CompareView.tsx` (Hour 14-16)
- Two Three.js scenes side by side
- Cancer type A vs cancer type B
- Shared lines pulse white
- Overlap count shown between scenes

---

## Phase 4 — Polish + Demo Prep (Hours 16-20)

- [ ] Dark theme consistency across all components
- [ ] Loading states while JSON fetches
- [ ] Elbow indicator text: "Suggested optimal: 8 lines" below slider
- [ ] Test the full demo sequence (see below) 3x
- [ ] Make sure everything works with backend OFF (static JSON only)
- [ ] Screenshot the app, make sure it looks good on projector

---

## Stretch Goal — RL Tab (Only if ahead of schedule)

`components/RLTab.tsx` + `src/rl_env.py`
- Don't touch this until Phase 3 is DONE

---

## Precomputed JSON Checklist

All must exist before demo:
- [ ] `public/precomputed/umap_3d.json`
- [ ] `public/precomputed/panel_all.json`
- [ ] `public/precomputed/panel_breast.json` (+ lung, cns, colon, leukemia, melanoma, ovarian, prostate, renal)
- [ ] `public/precomputed/coverage_curve.json`
- [ ] `public/precomputed/per_layer_coverage.json`
- [ ] `public/precomputed/validation.json`
- [ ] `public/precomputed/characterization.json` ← sister's output
- [ ] `public/precomputed/factor_annotations.json` ← sister's output

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
| Backend crashes | Switch frontend to read static JSON directly from `/public/precomputed/` |
| Fly-in animation too slow | Simplify to instant highlight + pulse ring |
| UMAP looks bad | Adjust `n_neighbors` (try 5, 10, 30) and `min_dist` (try 0.05, 0.3) |
| Cell line names don't match | Print first 5 names from each CSV and manually align before intersection |

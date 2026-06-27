# Nikhi's Hackathon Execution Plan

> You own: Python pipeline + FastAPI + Next.js + Three.js
> Sister owns: R cleaning scripts + fgsea annotation + characterization JSON

---

## Current Status (updated Jun 27, 2026)

| Area | Status |
|------|--------|
| Raw data download | Mostly done — `raw_data/` (metabolomics missing; methylation + histone extras) |
| Python deps | Done — `requirements.txt`, fastapi installed |
| Repo structure | Done — `frontend/`, `src/`, `api/`, `data/`, `raw_data/`, `r/` |
| Python pipeline | Scripts written; **blocked on sister's CSVs** for real run |
| Dummy data dev | `src/generate_dummy_data.py` → all JSON in `frontend/public/precomputed/` |
| FastAPI backend | Done — `api/main.py` + `/blindspot`, `/embeddings` |
| Frontend UI | Done on dummy data — full app wired, backend optional |
| Stretch goals | Blind Spot Detector ✅, Manual Override ✅, Adaptive Design ⬜ |
| Sister R pipeline | Started — `r/loading.R` loads Excel; no CSV export yet |

**Next up:** Sister exports `data/processed/*.csv` → run `fusion.py` through pipeline → swap dummy JSON → fly-in animation polish → demo rehearsal.

**Dev commands:**
```bash
python src/generate_dummy_data.py
uvicorn api.main:app --reload --port 8000
cd frontend && npm run dev
```

---

## Phase 0 — Setup

- [x] Download NCI-60 datasets from CellMiner: https://discover.nci.nih.gov/cellminer/
  - [x] RNA: `raw_data/rna_seq.xls`
  - [x] Proteomics: `raw_data/proteomics.xls`
  - [x] Drug activity: `raw_data/drug_activity.xlsx`
  - [x] Cell line metadata: `raw_data/Cell Line Metadata.xls`
  - [x] Gene sets (fgsea): `raw_data/Human Gene Sets v2026.1.gmt`
  - [ ] Metabolomics — **not downloaded**
  - Note: `methylation.xls`, `histone.xlsx` also present — decide if substitutes
  - Files in `raw_data/` (align to `data/raw/` when pipeline runs)
- [x] Install Python deps (`requirements.txt`):
  ```bash
  pip install fastapi uvicorn umap-learn scikit-learn kneed pandas numpy scipy
  ```
- [x] Scaffold frontend:
  ```bash
  npx create-next-app@latest frontend --typescript --tailwind
  cd frontend && npm install three @react-three/fiber @react-three/drei recharts axios
  ```
- [x] Folder structure:
  - [x] `frontend/` + `frontend/public/precomputed/`
  - [x] `src/`, `api/`, `data/raw/`, `data/processed/`
  - [x] `raw_data/`, `r/`

---

## Phase 1 — Python Pipeline

**Scripts written. Blocked on `data/processed/*.csv` from sister for real data run.**

| Script | Status | Output |
|--------|--------|--------|
| `src/fusion.py` | ✅ written (+ `embeddings.json` export) | `fused_matrix.csv`, `rna_pca_loadings.csv` |
| `src/selection.py` | ✅ written | `panel_all.json`, `panel_*.json` |
| `src/coverage.py` | ✅ written | `coverage_curve.json` |
| `src/validation.py` | ✅ written | `validation.json` |
| `src/umap_3d.py` | ✅ written | `umap_3d.json` |
| `src/blindspot.py` | ✅ written | `blindspot.json` |
| `src/generate_dummy_data.py` | ✅ done | all dummy JSON for dev |

**Run order (once CSVs exist):**
```bash
python src/fusion.py
python src/umap_3d.py
python src/selection.py
python src/coverage.py
python src/validation.py
python src/blindspot.py
```

---

## Phase 2 — FastAPI Backend — DONE

**`api/main.py`**

- [x] `GET /umap?cancer_type=all`
- [x] `GET /panel/{size}?cancer_type=all`
- [x] `GET /coverage`
- [x] `GET /validation`
- [x] `GET /characterization/{cell_line}`
- [x] `GET /blindspot`
- [x] `GET /embeddings`
- [x] `GET /health`
- Run: `uvicorn api.main:app --reload --port 8000`

Frontend reads static JSON directly — API optional for demo.

---

## Phase 3 — Frontend

### 3a. Layout — DONE
- [x] `page.tsx`: sidebar (25%) + main canvas + Explore/Compare tabs
- [x] Dark background `#050510`
- [x] Sidebar: slider (2–15), cancer dropdown, layer checkboxes

### 3b. Three.js Scene — `Scene3D.tsx` — MOSTLY DONE
- [x] Canvas, dynamic import, SSR-safe
- [x] Load `umap_3d.json`, render 60 spheres
- [x] Cancer type colors (`lib/constants.ts`)
- [x] OrbitControls + auto-rotate
- [x] Gold connection lines between selected
- [x] Red rim pulse on missing cancer types (blind spot)
- [x] Manual mode sphere states (gold / cyan / gray / default)
- [x] Click to toggle manual panel
- [ ] **Fly-in animation** on slider increment

### 3c. Sphere Interactions — MOSTLY DONE
- [x] Selected: larger gold `#FFD700`
- [x] Filtered: fade gray opacity 0.15
- [x] Hover tooltip (cell line + cancer type)
- [x] Gold connection lines
- [ ] Fly-in animation (arc + pulse ring)

### 3d. Coverage Curve — DONE
- [x] Wired to `coverage_curve.json`
- [x] Blue coverage + green validation lines
- [x] Dashed elbow line + gold slider reference
- [x] Cyan manual-coverage dot when in manual mode

### 3e. Radar Chart — DONE
- [x] `RadarChart.tsx` — 4 axes, updates with slider

### 3f. Selection Log — DONE
- [x] Table + cancer badges + top genes
- [x] CSV download
- [x] Shows manual panel when in manual mode

### 3g. Compare View — DONE
- [x] Two scenes side by side
- [x] Overlap count + white pulse on shared lines

---

## Phase 4 — Polish + Demo Prep

- [~] Dark theme consistency (base done)
- [x] Loading states while JSON fetches
- [x] Elbow indicator from real `coverage_curve.json` (dummy elbow = 8)
- [ ] Test full demo sequence 3x
- [x] Works with backend OFF (static JSON)
- [ ] Screenshot / projector check
- [ ] Fly-in animation

---

## Stretch Goal — Blind Spot Detector — DONE (dummy data)

### Level 1 — Cancer Type Coverage
- [x] `src/blindspot.py`
- [x] `frontend/public/precomputed/blindspot.json`
- [x] `BlindSpotPanel.tsx` — grid (red/yellow/green)
- [x] "Blind to: …" red banner
- [x] Red rim glow in `Scene3D.tsx`

### Level 2 — Pathway Coverage (stub; real fgsea later)
- [x] Pathway gap in `blindspot.py`
- [x] `pathway_gaps_by_size` in `blindspot.json`
- [x] Pathway list in `BlindSpotPanel.tsx`
- [~] `pathway_scores.json` — dummy exists; replace after sister fgsea

---

## Stretch Goal — Manual Override + Live Coverage — DONE

- [x] `embeddings.json` from `fusion.py`
- [x] `lib/coverage.ts` — browser-side `computeCoverage()`
- [x] `manualPanel`, `isManualMode`, `manualCoverage` in `page.tsx`
- [x] Slider resets to greedy
- [x] Click spheres to toggle panel
- [x] Four visual states in `Scene3D.tsx`
- [x] Cyan dot on `CoverageCurve.tsx`
- [x] "Reset to Optimal" in sidebar

---

## Stretch Goal — Adaptive Design Tab — NOT STARTED

`components/AdaptiveDesignTab.tsx` + `src/adaptive_design.py`
- Keep the main project unchanged; fixed-panel selection stays the real deliverable
- Sequential policy replay vs held-out drug prediction
- Output: `adaptive_design.json`

---

## Precomputed JSON Checklist

All in `frontend/public/precomputed/`:

- [x] `umap_3d.json`
- [x] `panel_all.json` + 9 per-type `panel_*.json`
- [x] `coverage_curve.json`
- [x] `per_layer_coverage.json`
- [x] `validation.json`
- [x] `blindspot.json`
- [x] `embeddings.json`
- [x] `pathway_scores.json` (dummy)
- [~] `characterization.json` (dummy → sister)
- [~] `factor_annotations.json` (dummy → sister fgsea)
- [ ] `adaptive_design.json` (stretch)

---

## Sister's R Pipeline

- [x] `qbi_hackathon.Rproj`
- [~] `r/loading.R` — loads Excel; paths still `~/Desktop/qbi_hackathon/`
- [ ] Export `data/processed/rna_clean.csv`, `prot_clean.csv`, `metab_clean.csv`, `drug_clean.csv`, `sample_info.csv`
- [ ] fgsea → real `factor_annotations.json` + `pathway_scores.json`
- [ ] Characterization → real `characterization.json`

---

## Demo Sequence (Memorize This)

1. **0-3s** — let the scene rotate silently. Say nothing.
2. **3s** — "Every dot is a cancer cell line…"
3. **15-45s** — slider 1 → 8, explain greedy selection.
4. **45-70s** — dropdown Breast Cancer.
5. **70-90s** — hover MCF7, read tooltip.
6. **90-110s** — coverage curve: blue = coverage, green = drug prediction.
7. **110-140s** — Compare tab: breast vs lung.
8. **Optional** — blind spot banner, click manual override to show coverage drop.
9. **170-200s** — closing line on redundant experiments.

**Total: ~3.5 minutes. Do not improvise.**

---

## If Things Break

| Problem | Fix |
|---------|-----|
| Sister's R script not done | `python src/generate_dummy_data.py` |
| Backend crashes | Frontend reads `/precomputed/` directly |
| Fly-in too slow | Instant highlight + pulse ring |
| UMAP looks bad | Tune `n_neighbors`, `min_dist` in `umap_3d.py` |
| Cell line names don't match | Print first 5 names per CSV before intersection |
| R paths wrong | `raw_data/` relative paths in `loading.R` |

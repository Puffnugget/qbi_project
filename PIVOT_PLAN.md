# Folklore Plan: Multi-Cell Tumor Screening Agent

## Summary

Build a demo where a tumor is **not one cell line**. It is a mixture of several cancer cell populations.

Example input:

```text
Tumor = 50% A375 + 30% SK-MEL-5 + 20% MDA-MB-435S
Budget = 6 drug tests
Goal = find a drug that exposes a hidden responder or resistant subclone
```

The system runs a screening game:

1. The tumor has multiple hidden subclones.
2. The agent chooses one drug to test.
3. The simulator shows how each subclone responds.
4. The agent learns from that result.
5. The agent chooses the next drug.
6. At the end, the system gives a clear conclusion.

Final pitch:

> Folklore simulates mixed tumors and trains an active-learning agent to choose the next drug test, so researchers can find responder and resistant subpopulations with fewer experiments.

## Current Status

### Done

- Frontend tab renamed in practice to **Adaptive Tumor Screening** / Folklore experience
- Canned frontend screen built with:
  - left tumor summary / mode panel
  - middle screening timeline with replay controls
  - right final recommendation card
  - bottom active learner vs random chart
- `frontend/public/precomputed/folklore.json` — now generated from real NCI-60 drug matrix (`source: simulator`); no longer hand-written
- Frontend data contract added for Folklore JSON shape
- UI loads Folklore data without requiring live backend endpoints (offline-safe)
- 5 preset tumors: melanoma mixed, breast heterogeneous, colon robust-drug search, lung dual-clone resistance, renal two-clone backup
- Every preset has `active_learner` and `random` rollouts with 6 unique drug tests; **active learner wins 5/5 presets**
- **Ground-truth simulator** (`src/folklore/simulator.py`):
  - loads `drug_activity_landmark_matrix.csv` + metadata + `sample_info.csv`
  - mixed-tumor response = proportionally weighted sum across subclones
  - labels each subclone sensitive / intermediate / resistant
  - flags resistant-survivor cases; self-check passes
- **Episode environment** (`src/folklore/environment.py`):
  - no duplicate drug tests per episode, budget 1–10
  - 4 heuristic policies: `random`, `greedy`, `uncertainty`, `active_learner`
  - active learner = greedy score + 0.35 × subclone-disagreement bonus (placeholder until RunPod model)
  - self-check passes end-to-end
- **`scripts/generate_folklore.py`** — regenerates `folklore.json` from real simulator (5 presets × 2 policies)
- **`POST /folklore/regenerate`** backend endpoint — rebuilds `folklore.json` on demand; frontend calls it via "Regenerate presets from simulator" button in the canned-demo panel
- Backend endpoints all live:
  - `GET /folklore` — serves precomputed rollouts
  - `GET /folklore/catalog` — 60 cell lines, 150 landmark drugs, mechanisms, demo tumors
  - `POST /folklore/run` — live episode from user input (replaced 501 stub)
  - `POST /folklore/regenerate` — rebuilds `folklore.json` from simulator
- **Frontend live mode fully built** (`components/AdaptiveDesignTab.tsx`):
  - mixture editor — 2–4 subclones, cell-line dropdowns, proportion inputs, Normalize button
  - goal select + budget slider (6–10)
  - drug-pool picker — searchable, mechanism-filtered multi-select; never offers off-catalog drug
  - input validation with inline errors; Run blocked until valid
  - `POST /folklore/run` wired; live result renders in same timeline/recommendation/chart
  - failed live run → toast + fall back to nearest canned case (matched by cell-line overlap)
  - catalog loads lazily on first live-mode open
- Data layer (`lib/data.ts`): `fetchFolkloreCatalog()`, `runFolklore()`, `regenerateFolklore()`, `isFolkloreCatalogReady()`
- Types (`lib/types.ts`): `FolkloreCatalog`, `FolkloreCatalogDrug`, `FolkloreCatalogCellLine`, `FolkloreRunRequest`, `FolkloreRunResponse`, `FolkloreRegenerateResponse`
- Frontend typecheck (`tsc --noEmit`) passes clean
- **Error states + loading skeletons** (Phase 4 polish): shared `Alert`, `Skeleton`, `Toast`; retry on failed fetches in Explore / Compare / TINA; production build passes

### Next Todo

See **Remaining work** below — single owner (you): biology, RunPod training, wire-up. See `REMAINING.md` for the active checklist (presentation/script deferred).

---

## Remaining work (you — full ownership)

Sister tasks are **reassigned to you**. Do in order where dependencies apply.

### A. Biology + catalog (do first)

| # | Task | Output | Done when |
|---|------|--------|-----------|
| A1 | Verify drug-response **sign/direction** in landmark matrix (negative = sensitive?) | `docs/folklore_response_sign.md` or note in repo | Preset stories match matrix math |
| A2 | Audit bad/missing cell line × drug pairs | `docs/folklore_catalog_audit.md` or drop list | No demo drug has &lt;55/60 lines without explicit flag |
| A3 | Curate **demo drug subset** (~30–40 high-signal compounds) | `processed_data/clean/drug_landmarks/demo_drugs.json` | Kinase-filter uses believable options |
| A4 | Clean **mechanism labels** on step cards | Metadata fixes or override map in repo | Timeline mechanisms aren’t nonsense |

### B. RunPod model (blocks real active learner)

| # | Task | Output | Done when |
|---|------|--------|-----------|
| B1 | Export **per-cell-line feature slice** for training | `processed_data/folklore/train_features.parquet` + column README | `(cell_line, drug) → features` loadable |
| B2 | Document **train/val split** | `docs/folklore_train_split.md` | No cell-line leakage in val set |
| B3 | **Train PyTorch ensemble on RunPod** (5 small MLPs) | `scripts/train_folklore_ensemble.py` + checkpoint | Val loss stable |
| B4 | Export **predictions + uncertainty** | `processed_data/folklore/predictions.parquet` — columns: `cell_line`, `drug`, `mean`, `std` | Full landmark grid covered |

### C. Software wire-up (after B4, or stub now)

| # | Task | Files | Done when |
|---|------|-------|-----------|
| C1 | Define **predictions schema** + loader | `src/folklore/predictions.py` | Unit test: known cell/drug returns mean/std |
| C2 | Wire loader into **`active_learner`** | `src/folklore/environment.py` → `_policy_score()` (~line 136) | Score uses ensemble std, not matrix-variance placeholder |
| C3 | **Fallback** when predictions file missing | Same env — heuristic if parquet absent | Demo works offline before B4 lands |
| C4 | **Review live outputs**; tune sensitive/resistant thresholds | `src/folklore/simulator.py` if needed | No preset tells an impossible story |
| C5 | **Regenerate canned rollouts** | `python scripts/generate_folklore.py` | `folklore.json` reflects model-backed policy |
| C6 | Verify **active learner ≥ random on 3/5** presets | Script output | Success criteria still met |
| C7 | **Review live outputs**; tune sensitive/resistant thresholds | `src/folklore/simulator.py` if needed | No preset tells an impossible story |
| C8 | Confirm **offline fallback** | Canned JSON with API stopped | Demo survives without backend |

**Phase 4 gate:** A1–A4 + B4 + C2 + C5 + C6 + C8.

#### `_policy_score` target (C2)

```python
# today (placeholder):
return greedy + (0.35 * uncertainty)  # pstdev across subclone matrix responses

# after B4:
# mixed mean = weighted sum of per-subclone model means
# uncertainty = weighted sum (or max) of per-subclone ensemble std
return -predicted_mixed_mean + (lambda_unc * predicted_uncertainty)
```

Tune `lambda_unc` while rehearsing kinase-filter and proportion-change demos.

---

### Suggested order (solo)

```text
1. A1–A4     biology + catalog (1–2 days)
2. C1 + C3   loader stub + fallback (can parallel A)
3. B1–B4     features → RunPod train → predictions.parquet (2–3 days)
4. C2, C5–C8 wire policy, regenerate, verify win rate, offline check
```

Presentation/script (hooks, copy pass, rehearsal) → deferred; see `REMAINING.md`.

---

### Dependencies

| Blocked | Unblock with |
|---------|----------------|
| Real model uncertainty (C2) | B4 predictions file |
| Optional `drug_catalog.json` | A2 catalog audit |

---

### Done (removed from active todo)

- ~~Resolve final frontend validation after merge conflict cleanup~~ — `npm run build` passes
- ~~Error states, loading skeletons~~ — shipped in `Alert`, `Skeleton`, `Toast` + tab wiring

### Former sister scope (now yours)

All items previously labeled S1–S11 are folded into **A1–A4**, **B1–B4**, and **C7** above. Presentation/script tasks deferred to `REMAINING.md`.


## What The Input And Output Mean

### Input

The user gives:

- 2-4 NCI-60 cell lines
- mixture proportions
- number of drug tests allowed
- optional cancer type focus
- optional goal: `find responder`, `find resistance`, or `find robust drug`

Example:

```json
{
  "tumor_name": "Melanoma mixed tumor",
  "components": [
    { "cell_line": "ME:A375", "proportion": 0.5 },
    { "cell_line": "ME:SK-MEL-5", "proportion": 0.3 },
    { "cell_line": "ME:MDA-MB-435S", "proportion": 0.2 }
  ],
  "budget": 6,
  "goal": "find resistance"
}
```

### Output

The output must give an actual resolution, not just a chart.

It should answer:

- Which drugs did the agent test?
- What did it learn after each test?
- Which subclone looked sensitive or resistant?
- Which final compound is recommended?
- Why is that recommendation useful?
- Did the active learner beat random screening?

Final result example:

```text
Final readout:
Drug A looked strong on average, but SK-MEL-5 stayed resistant.
Drug B was less dramatic overall but worked across all three subclones.
The agent recommends testing Drug B next because it is more robust against heterogeneity.
Active learner found this by test 4; random screening did not find it within 6 tests.
```

This is the key product moment.

## Core Build

### 1. Multi-Cell Tumor Simulator

Use existing NCI-60 data.

Each tumor is:

```text
subclone 1 + subclone 2 + subclone 3
```

Not:

```text
one averaged cell
```

For each drug:

- compute response for each subclone
- compute total mixed tumor response
- detect if one subclone survives
- mark that as possible resistance

This makes the biology clear.

### 2. Drug Testing Environment

Create a simple RL-style environment.

- `state`: tumor mixture plus past drug tests
- `action`: choose next drug
- `observation`: drug response after testing
- `reward`: strong discovery, resistant subclone found, or uncertainty reduced
- `episode`: one full screening run with 6-10 drug tests

Keep the first version simple:

- `random` policy
- `greedy` policy
- `uncertainty` policy
- `active learner` policy

Active learner score:

```text
score = predicted usefulness + uncertainty bonus
```

This is understandable and demoable.

### 3. GPU Model

Train a small model on RunPod.

Input:

```text
multi-omics features for a cell line
```

Output:

```text
drug response predictions
```

Use a small PyTorch ensemble:

- 5 small MLP models
- average prediction = expected response
- disagreement = uncertainty

Why this matters:

- The agent is not only hardcoded.
- The agent has uncertainty.
- The agent can choose experiments that teach it something.

### 4. Frontend

Build on the existing app.

Upgrade the current **Adaptive Design** tab into:

```text
Adaptive Tumor Screening
```

Screen layout:

- Left: tumor mixture editor
- Middle: screening timeline
- Right: final recommendation
- Bottom: chart comparing active learner vs random

Frontend needs to show:

- selected subclones and proportions
- current test number
- compound chosen by the agent
- subclone responses
- mixed tumor response
- best drug found so far
- final conclusion card

The final card is the most important part.

## Live Demo Mode

The judge demo must support **two modes** without breaking if the API or RunPod is offline.

| Mode | When to use | Behavior |
|------|-------------|----------|
| **Canned** | WiFi down, RunPod offline, first 30 seconds of pitch | Load `frontend/public/precomputed/folklore.json` — 5 preset tumors with full rollouts |
| **Live** | Q&A, “what if we try X?”, rehearsal | User picks tumor mixture + drugs from the **available catalog**, backend runs a new rollout |

### What “live” means

During the demo you can change inputs and re-run screening on the spot:

- **Tumor mixture** — pick 2–4 NCI-60 lines and proportions (must sum to 1.0)
- **Drug pool** — choose from compounds we actually have in data (default: ~150 landmark drugs; optional filter by mechanism or cancer type)
- **Budget** — 6–10 tests per episode
- **Goal** — `find responder`, `find resistance`, or `find robust drug`
- **Policy** — compare `active learner` vs `random` (and optionally greedy / uncertainty)

The UI must never offer a drug that is not in the catalog. If the user picks an invalid combo, show a clear error — do not silently fail.

### Drug catalog (source of truth)

All live and canned runs use the same compound list:

- Matrix: `processed_data/clean/drug_landmarks/drug_activity_landmark_matrix.csv` (~150 drugs × 60 cell lines)
- Metadata: `processed_data/clean/drug_landmarks/drug_activity_landmark_metadata.csv` (name, mechanism class)

You own catalog correctness and exposing it via API/UI.

### Live API contract

Add alongside the static file:

```text
GET  /folklore/catalog          → available cell lines, drugs, mechanisms, demo tumors
GET  /folklore                  → precomputed canned rollouts (offline-safe)
POST /folklore/run              → run one live episode from user input
```

`POST /folklore/run` body:

```json
{
  "tumor_name": "Melanoma mixed tumor",
  "components": [
    { "cell_line": "ME:A375", "proportion": 0.5 },
    { "cell_line": "ME:SK-MEL-5", "proportion": 0.3 },
    { "cell_line": "ME:MDA-MB-435S", "proportion": 0.2 }
  ],
  "budget": 6,
  "goal": "find resistance",
  "policy": "active_learner",
  "drug_pool": ["Sorafenib", "Trametinib", "Vemurafenib"],
  "compare_policy": "random"
}
```

- `drug_pool` optional — if omitted, use full landmark catalog
- Response: same step + final JSON shape as precomputed rollouts
- Live runs use **ground-truth** responses from the drug matrix; model predictions only drive **which drug to test next**

### Live demo UX (your frontend)

- Left: tumor mixture editor + goal + budget
- Drug panel: searchable list from `/folklore/catalog` with mechanism tags; multi-select to narrow pool
- Middle: step-through timeline (play / pause / scrub) — same controls as current Adaptive Design tab
- Right: final recommendation card
- Bottom: active learner vs random curve for this run
- Toggle: **Canned demos** dropdown vs **Run live** button
- If `POST /folklore/run` fails → toast + fall back to nearest canned tumor

### Demo script (for judges)

1. Show canned melanoma tumor (30 s story)
2. “What if we only test kinase inhibitors?” → filter drug pool live → re-run
3. “What if the resistant clone is smaller?” → change proportions → re-run
4. Point to conclusion: agent found heterogeneity faster than random

---

## Phased Plan

Build in order. Each phase has a **gate** — do not start the next phase until the gate passes.

### Phase 0 — Foundation (~2 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **You** | Define `folklore.json` schema; stub catalog/folklore endpoints; agree 5 preset tumors | Frontend fetches without 404 |
| **You** | Verify drug-response sign/direction; audit catalog; optional `drug_catalog.json` | Every demo drug has ≥55/60 line responses |

**Gate:** catalog source loads + schema agreed + 5 preset tumors defined.

**Status:** software foundation complete; biology/catalog audit still open (**A1–A2**)

- [x] `folklore.json` schema defined in frontend types and canned data
- [x] Frontend loads `frontend/public/precomputed/folklore.json`
- [x] `GET /folklore/catalog` stub
- [x] `GET /folklore` stub
- [x] `POST /folklore/run` explicit not-yet-implemented stub
- [x] 5 preset tumors agreed and filled in
- [x] Catalog API derives cell lines and drugs from local landmark data
- [ ] Verify drug-response sign/direction (**A1**)
- [ ] Audit bad or missing cell line × drug pairs (**A2**)
- [ ] Optional: export static `frontend/public/precomputed/drug_catalog.json`

---

### Phase 1 — Ground-truth simulator (~3 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **You** | Curate demo drug subset; clean mechanism labels (**A3–A4**) | `demo_drugs.json` |
| **You** | ~~`simulator.py` + `environment.py`~~ | **Done** |

**Gate:** one full random rollout JSON for one preset tumor, generated from real drug matrix.

**Status:** simulator done; biology curation open (**A3–A4**)

- [x] Create `src/folklore/simulator.py`
- [x] Load `processed_data/clean/drug_landmarks/drug_activity_landmark_matrix.csv`
- [x] Load `processed_data/clean/drug_landmarks/drug_activity_landmark_metadata.csv`
- [x] Compute mixed response as weighted sum across subclones
- [x] Label subclone responses as sensitive / intermediate / resistant
- [x] Flag resistant-survivor cases
- [x] Add a small manual-check test fixture
- [x] Create `src/folklore/environment.py`
- [x] Enforce no duplicate drug tests per episode
- [x] Run one random rollout end-to-end from real data

---

### Phase 2 — Policies + canned rollouts (~3 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **You** | Export training features; train/val split; RunPod ensemble start (**B1–B3**) | Training script runs on sample batch |
| **You** | ~~Policies + `generate_folklore.py`~~ | **Done** |

**Gate:** `folklore.json` complete; active learner wins on majority of canned tumors.

**Status:** canned frontend data complete; generated real-data rollouts blocked on simulator / policy code

- [x] Canned `folklore.json` exists for frontend development
- [x] Hand-written canned data has 5 tumors x 2 policies
- [x] Heuristic `random`, `greedy`, `uncertainty`, and `active_learner` policies implemented
- [x] Generated from real data (`folklore.json` now has `source: simulator`)
- [x] Generated 5 tumors x 2 policies complete
- [x] Active learner beats random on >= 3/5 presets from actual rollout script (5/5)
- [x] Add `scripts/generate_folklore.py`
- [x] `POST /folklore/regenerate` rebuilds `folklore.json` on demand from the frontend

---

### Phase 3 — Live run path (~3 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **You** | `POST /folklore/run`, live UI, catalog picker | Live demo with custom drug pool |
| **You** | Review live outputs; tune thresholds if needed (**C4**) | No impossible mechanism stories |

**Gate:** live demo end-to-end; canned fallback with API stopped.

**Status:** live baseline done; threshold review open (**C4**)

- [x] Canned vs live mode toggle exists in UI shell
- [x] Replay controls exist
- [x] Catalog fetch helper exists
- [x] Catalog drug picker (searchable + mechanism filter; needs catalog endpoint to populate)
- [x] Mixture editor (2–4 subclones, proportion validation + normalize)
- [x] Live error toast + canned fallback (nearest case by cell-line overlap)
- [x] Frontend wired to `POST /folklore/run` + `GET /folklore/catalog`
- [x] `POST /folklore/run` **backend** endpoint (live shape works; policies still baseline)
- [x] `GET /folklore/catalog` **backend** endpoint
- [x] `GET /folklore` **backend** endpoint
- [x] Resolve final frontend validation (`npm run build` clean)
- [ ] Review live run outputs + tune thresholds (**C4**)

---

### Phase 4 — GPU model + polish (~4 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **You** | RunPod train + export predictions (**B3–B4**) | `predictions.parquet` in repo |
| **You** | Wire predictions into `active_learner` (**C1–C3**) | Model uncertainty, not placeholder |
| **You** | Biology pass on presets + step copy (**C7**) | Believable `why_chosen` / mechanisms |
| **You** | ~~Error states + loading~~ | **Done** |
| **You** | Demo rehearsal (**C8**) | Canned + 2 live scenarios without crashes |

**Gate:** success criteria below all green.

**Status:** polish done; see **Remaining work** A–C

- [x] Error states + loading skeletons (Explore, Compare, TINA, Analyze)
- [ ] Biology + catalog (**A1–A5**)
- [ ] RunPod train + predictions export (**B1–B4**)
- [ ] Predictions loader + active_learner wire-up (**C1–C3**)
- [ ] Regenerate `folklore.json`; active learner ≥3/5 vs random (**C5–C6**)
- [ ] Final biology pass on rollouts (**C7**)
- [ ] Demo rehearsal (**C8**)

---

### Phase 0 preset tumors (canonical — matches `scripts/generate_folklore.py`)

| # | Name | Mixture | Goal | Hook (refine in **A5**) |
|---|------|---------|------|------|
| 1 | Melanoma mixed | 50% SK-MEL-28 / 30% SK-MEL-5 / 20% MDA-MB-435 | find resistance | BRAF-heavy picks; SK-MEL-5 survives |
| 2 | Breast heterogeneous | 45% MCF7 / 35% T-47D / 20% MDA-MB-231 | find responder | Hidden sensitive subpopulation |
| 3 | Colon mixture | 40% HCT-116 / 35% HT29 / 25% KM12 | find robust drug | No single clone drives average |
| 4 | Lung dual clone | 55% A549 / 45% NCI-H460 | find resistance | EGFR-heavy average hides flat second clone |
| 5 | Renal backup | 60% 786-0 / 40% A498 | find robust drug | Fast 2-clone live demo |

Update hooks in `scripts/generate_folklore.py` (**A5**), then regenerate JSON.

---

## Work Split (summary)

**Single owner: you.** Phases 0 → 4 — software, biology, RunPod, demo.

Build:

- RL environment + policies + live/canned API
- frontend TINA tab + drug picker + replay
- verify drug-response direction + catalog audit + demo drug curation
- mechanism labels + tumor narratives
- PyTorch ensemble on RunPod + predictions export
- wire model into `active_learner`; regenerate rollouts; rehearsal

Main goal:

> Demo feels like a live adaptive experiment, with biologically believable tumors and conclusions — including “what if we only test kinase inhibitors?”

## Data And Interfaces

Use existing data:

- `processed_data/pca/fused_matrix.csv`
- `processed_data/log_zscored/drug_activity_log_zscored.csv`
- `processed_data/clean/drug_landmarks/drug_activity_landmark_matrix.csv`
- `processed_data/clean/drug_landmarks/drug_activity_landmark_metadata.csv`
- `processed_data/sample_info.csv`

Add generated files:

```text
frontend/public/precomputed/folklore.json     # canned rollouts (offline-safe)
frontend/public/precomputed/drug_catalog.json # optional; after A2 catalog audit
```

Add endpoints:

```text
GET  /folklore/catalog   # cell lines, drugs, mechanisms, preset tumors
GET  /folklore           # canned rollouts
POST /folklore/run       # live episode from user tumor + drug pool
```

The JSON should include:

- demo tumors
- tumor components
- rollout steps
- policy comparison
- final recommendation
- short explanation

Step output:

```json
{
  "step": 1,
  "compound": "Drug name",
  "mechanism": "MEK inhibitor",
  "chosen_by": "active learner",
  "mixed_response": -1.4,
  "subclone_responses": [
    { "cell_line": "ME:A375", "response": -1.8, "label": "sensitive" },
    { "cell_line": "ME:SK-MEL-5", "response": 0.2, "label": "resistant" }
  ],
  "why_chosen": "High uncertainty and possible resistant subclone signal.",
  "best_response_so_far": -1.4
}
```

Final output:

```json
{
  "recommended_compound": "Drug B",
  "main_realization": "Drug A looked strong on average, but one subclone stayed resistant.",
  "next_experiment": "Test Drug B because it is predicted to hit the resistant subclone.",
  "active_vs_random": "Active learner found the resistant subclone by test 4; random did not within 6 tests."
}
```

## Test Plan

Minimum checks:

- Generate at least 5 demo tumors.
- Each tumor has 2-4 subclones.
- Proportions add to 1.0.
- Each rollout has 6-10 drug tests.
- No policy tests the same drug twice in one episode.
- Each final output includes a recommendation and realization.
- Frontend loads without API failure.
- Demo still works from precomputed JSON if RunPod is offline.
- Live mode accepts custom `drug_pool` filtered to catalog; invalid drugs rejected with error.
- Canned fallback works when API is stopped mid-demo.

Success criteria:

- A judge can understand the demo in under 30 seconds.
- The output gives a real conclusion.
- The active learner beats random in at least 3 of 5 demo tumors.
- The project clearly shows multiple cell populations, not one averaged cell.

## Assumptions

- For v1, `perturbation` means drug/compound test.
- We do not add CRISPR perturbations unless there is time and data.
- RunPod is only for offline training.
- The live demo runs locally.
- We use simple active learning first; full PPO is optional only after the demo works.

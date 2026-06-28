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

### Next Todo

- **Resolve final frontend validation after merge conflict cleanup** (Phase 3 open item)
- Replace heuristic active-learner with model-backed uncertainty once RunPod predictions exist (Phase 4)
- Sister/bioinformatics: verify response direction, audit catalog correctness, curate demo drug subset, write biology blurbs per preset
- Wire RunPod ensemble predictions into `active_learner` policy (Phase 4)
- Full judge rehearsal: canned pitch + 2 live "what if" scenarios

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

Sister owns catalog correctness. You own exposing it to the API and UI.

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

### Phase 0 — Shared foundation (both, ~2 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **Sister** | Verify drug-response sign/direction in landmark matrix; flag bad or missing cell line × drug pairs; export `drug_catalog.json` (id, name, mechanism, n_cell_lines) | Catalog loads; every demo drug has ≥55/60 line responses |
| **You** | Define `folklore.json` schema; stub `GET /folklore/catalog` and `GET /folklore` returning empty/minimal JSON; document in this file | Frontend can fetch catalog without 404 |
| **Both** | Agree on 5 preset demo tumors (names, mixtures, goals, one-line biology hook) | List written in Phase 0 section below |

**Gate:** catalog source loads + schema agreed + 5 preset tumors defined on paper.

**Status:** software foundation complete; biology/catalog audit still needs review

- [x] `folklore.json` schema defined in frontend types and canned data
- [x] Frontend loads `frontend/public/precomputed/folklore.json`
- [x] `GET /folklore/catalog` stub
- [x] `GET /folklore` stub
- [x] `POST /folklore/run` explicit not-yet-implemented stub
- [x] 5 preset tumors agreed and filled in
- [x] Catalog API derives cell lines and drugs from local landmark data
- [ ] Sister verifies drug-response sign/direction
- [ ] Sister audits bad or missing cell line x drug pairs
- [ ] Optional: export static `frontend/public/precomputed/drug_catalog.json`

---

### Phase 1 — Ground-truth simulator (parallel, ~3 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **Sister** | Curate landmark subset for demos (~30–40 high-signal drugs); clean mechanism labels; write 2-sentence biology blurb per preset tumor | `demo_drugs.json` + tumor narratives checked in |
| **You** | ~~`src/folklore/simulator.py` — mixed tumor response = weighted sum of subclone responses from matrix; resistance flag when one subclone stays above threshold; unit test on 3 drugs × 3 lines~~ | **Done:** simulator self-check matches manual 3-line weighted sum |
| **You** | ~~`src/folklore/environment.py` — state, action (pick drug), no duplicate drugs per episode, episode length = budget~~ | **Done:** random policy runs end-to-end with no duplicate compounds |

**Gate:** one full random rollout JSON for one preset tumor, generated from real drug matrix.

**Status:** software complete; needs biology review

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

### Phase 2 — Policies + canned rollouts (parallel, ~3 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **Sister** | Export per-cell-line features slice for model training; document train/val split; start RunPod ensemble spec (5 MLPs) | Training script runs on sample batch |
| **You** | ~~Policies: `random`, `greedy`, `uncertainty`, `active_learner` (uncertainty bonus even before GPU model — use matrix variance or placeholder)~~ | **Done:** heuristic policies select different drugs from real matrix scores |
| **You** | `scripts/generate_folklore.py` → `frontend/public/precomputed/folklore.json` (5 tumors × 2 policies × steps + finals) | File committed; frontend loads it |

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

### Phase 3 — Live run path (you lead, sister supports, ~3 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **You** | `POST /folklore/run` — validate input, filter drug pool to catalog, run episode, return rollout + comparison policy | curl POST returns valid rollout in <3 s locally |
| **You** | Upgrade Adaptive Design tab → **Adaptive Tumor Screening**: catalog drug picker, mixture editor, canned vs live toggle, replay controls | Can run live with custom drug pool from UI |
| **Sister** | Review live run outputs for biological nonsense; adjust thresholds (sensitive/resistant labels) | No demo tumor produces impossible mechanism story |

**Gate:** live demo works end-to-end with custom drug pool; canned fallback works with API stopped.

**Status:** live baseline works; real policy behavior pending

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
- [ ] Resolve final frontend validation after merge conflict cleanup

---

### Phase 4 — GPU model + polish (parallel, ~4 days)

| Owner | Tasks | Done when |
|-------|-------|-----------|
| **Sister** | Train PyTorch ensemble on RunPod; export `predictions.parquet` or JSON (cell_line × drug → mean, std); plug into active learner score | Agent uses model uncertainty, not placeholder |
| **Sister** | Final biology pass on all 5 presets + mechanism text on step cards | Every step has believable `why_chosen` / mechanism |
| **You** | Wire model predictions into `active_learner` policy; active vs random chart; final conclusion card; error states + loading | Judge path ≤30 s; demo survives offline |
| **Both** | Rehearsal: canned pitch + 2 live “what if” scenarios (drug filter, proportion change) | Run-through without crashes |

**Gate:** success criteria below all green.

**Status:** not started

---

### Phase 0 preset tumors (draft — edit together)

| # | Name | Mixture | Goal | Hook |
|---|------|---------|------|------|
| 1 | Melanoma mixed | 50% A375 / 30% SK-MEL-5 / 20% MDA-MB-435S | find resistance | Average looks good; one clone survives BRAF path |
| 2 | Breast heterogeneous | 45% MCF7 / 35% T-47D / 20% MDA-MB-231 | find responder | Hidden sensitive subpopulation |
| 3 | Colon mixture | 40% HCT-116 / 35% HT29 / 25% KM12 | find robust drug | No single clone drives average |
| 4 | Lung dual clone | TBD | find resistance | Mechanism mismatch across clones |
| 5 | Backup simple | 2 clones only | find robust drug | Fast live demo if time is short |

---

## Work Split (summary)

### You — software + RL + demo

Phases: **0** (schema/API stub) → **1** (simulator, env) → **2** (policies, JSON) → **3** (live POST, UI) → **4** (model wire-up, polish)

Build:

- RL-style environment + policies
- rollout / live run generation
- `GET /folklore`, `GET /folklore/catalog`, `POST /folklore/run`
- frontend demo tab + drug picker + replay
- canned vs live demo toggle

Your main goal:

> Make the demo feel like an adaptive experiment happening live — including “what if we only test these drugs?”

### Sister — bioinformatics + model + biology

Phases: **0** (catalog audit) → **1** (demo drugs, narratives) → **2** (training data, RunPod start) → **3** (threshold review) → **4** (ensemble export, biology pass)

Build:

- verify drug-response direction
- drug catalog + landmark curation
- compound mechanism labels
- train PyTorch ensemble on RunPod
- export predictions and uncertainty
- biological explanations for demo tumors

Her main goal:

> Make tumor mixtures, drug choices, and conclusions biologically believable — and ensure live runs only use real compounds we have.

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
frontend/public/precomputed/drug_catalog.json # sister: catalog for live drug picker
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

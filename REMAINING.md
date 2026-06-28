# Folklore / TINA — What's Left

Two phases of **technical** work. Presentation, pitch script, tumor hooks, and rehearsal are out of scope for now.

Already done: simulator, policies, live API, TINA UI (canned + live), error/loading polish, `folklore.json` from real matrix (heuristic active learner).

---

## Phase 1 — Biology & catalog ✅

**Verified 2026-06-28** — data script + Playwright UI (`node scripts/verify_phase1_ui.mjs`).

| Task | Status | Artifact |
|------|--------|----------|
| Verify drug-response sign | ✅ | `docs/folklore_response_sign.md` |
| Audit missing/bad cell × drug pairs | ✅ | `docs/folklore_catalog_audit.md` |
| Curate ~30–40 demo drugs | ✅ | `processed_data/clean/drug_landmarks/demo_drugs.json` (52 drugs) |
| Clean mechanism labels | ✅ | `mechanism_overrides.json` + `src/folklore/mechanisms.py`; catalog & rollouts regenerated |
| Stub predictions loader + offline fallback | ✅ | `src/folklore/predictions.py` + heuristic in `environment.py` |

**Re-run checks:**

```bash
python scripts/verify_phase1_folklore.py
node scripts/verify_phase1_ui.mjs   # needs frontend on :3000 + API on :8000
```

**Bug fixed during verification:** `AdaptiveDesignTab` set state during render → blank TINA panel; fixed with `useEffect` when parent `adaptiveData` arrives.

---

## Phase 2 — RunPod model & wire-up

**Goal:** Active learner picks drugs using **model uncertainty**, not matrix-variance placeholder.

| Task | Deliverable |
|------|-------------|
| Export training features (cell line omics + drug targets) | `processed_data/folklore/train_features.parquet` |
| Document train/val split (no cell-line leakage) | `docs/folklore_train_split.md` |
| Train 5-MLP PyTorch ensemble on RunPod | `scripts/train_folklore_ensemble.py` + checkpoint |
| Export full-grid predictions | `predictions.parquet`: `cell_line`, `drug`, `mean`, `std` |
| Wire predictions into `active_learner` | Already stubbed in `environment.py`; activates when parquet exists |
| Regenerate canned rollouts with new policy | Updated `frontend/public/precomputed/folklore.json` |
| Verify active learner beats random on ≥3/5 presets | Script check or manual |
| Review live run outputs; tune sensitive/resistant thresholds if needed | Changes in `src/folklore/simulator.py` if required |
| Confirm offline fallback | Canned JSON loads when API is stopped |

**What RunPod trains:** cell line multi-omics (from `fused_matrix.csv`) → predicted drug response. Ensemble **mean** = expected response; **std** = uncertainty. Ground-truth step outcomes still come from the landmark matrix — the model only chooses **which drug to test next**.

**Gate:** `predictions.parquet` in repo; active learner uses ensemble std; win rate ≥3/5; offline canned path works.

**Order:** Export features → RunPod train → predictions → regenerate JSON → verify.

---

## Success criteria (technical)

- Active learner beats random on ≥3/5 preset tumors
- App works from precomputed JSON if RunPod/API is offline
- Live runs use ground-truth matrix responses; model drives drug selection only

---

## Deferred (presentation & script — later)

- 2-sentence biology hooks per preset tumor
- Final copy pass on `why_chosen` / conclusion cards
- Demo rehearsal and judge pitch script
- “What if” live demo walkthrough for Q&A

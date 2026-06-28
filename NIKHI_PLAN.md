# QBI Hackathon Working Plan

This is the execution plan to work from. `plan.md` stays the long reference doc. This file is the operational version: what we are optimizing for, who owns what, what is already done, and what still matters before demo time.

## 1. What We Are Actually Optimizing For

From `plan.md`, the project should optimize for these judge-facing outcomes:

1. **Impact**
   - Clear scientific pain point: researchers waste money on redundant cell-line experiments.
   - Output must feel immediately useful to a biologist, not like a toy viz.

2. **Execution**
   - The app must run cleanly end to end.
   - Demo must survive WiFi failure and backend failure.
   - Static precomputed JSON is the default demo path.

3. **Novelty**
   - Multi-omics panel selection is the base novelty.
   - Strongest differentiators already in scope:
     - fused multi-omics selection
     - empirical drug-response validation
     - blind-spot detection
     - adaptive design stretch tab

4. **Team composition / division of labor**
   - Show real cross-discipline collaboration.
   - The split should be obvious: R + biology interpretation, Python + product + frontend, plus shared demo/story work.

## 2. Success Metrics We Should Optimize

These are the parameters that matter most in the current plan:

- **Coverage quality:** panel coverage curve should plateau cleanly and be easy to explain.
- **Validation quality:** Ridge-based drug prediction curve should track coverage and justify chosen panel size.
- **Interpretability:** selected lines need plain-English reasons and biological context.
- **Demo robustness:** everything critical available from `frontend/public/precomputed/`.
- **Visual clarity:** 3D scene, compare mode, and charts must read instantly on a projector.
- **Time discipline:** do not spend time on upgrades that do not improve judging outcome tomorrow.

## 3. Current State

### Done

- Real R cleaning + PCA fusion pipeline exists.
- `processed_data/pca/fused_matrix.csv` exists and is feeding the app.
- Frontend is built and already has:
  - Explore
  - Compare
  - Adaptive Design
  - Analyze Your Data
- Core precomputed JSON outputs are already present.
- Blind spot, manual override, pathway scores, characterization, and protein lookup exist.
- Static JSON fallback path for demo already exists.

### Still worth doing

- Wire filter controls into the main Explore flow if it is low-risk.
- Rehearse the exact demo sequence until it is boring.
- Verify the UI on the actual presentation machine / projector setup.
- Tighten the story so every screen directly supports judging criteria.

### Not worth doing unless everything above is done

- MOFA+ swap
- foundation model embeddings
- CCLE scale-up
- full active-learning upgrade beyond existing adaptive design baseline

## 4. Owner Split

## Nikhi

Primary owner: product, frontend, backend, Python pipeline, final demo behavior

### Must do

- [ ] Smoke-test the full app using the real fused matrix path.
- [ ] Verify all required JSON files still load cleanly from `frontend/public/precomputed/`.
- [ ] Wire `FilterControls.tsx` into Explore **only if** the diff stays small and does not destabilize the demo.
- [ ] Verify the main story path:
  - slider
  - cancer filter
  - hover explanation
  - coverage + validation chart
  - compare view
  - optional blind spot / adaptive design / analyze tab
- [ ] Rehearse the 3.5-minute demo three times.
- [ ] Do one projector/fullscreen sanity check.

### Should do if time remains

- [ ] Make sure the displayed default panel size is the one you want to defend verbally.
- [ ] Trim any distracting UI copy or controls that do not support the demo story.
- [ ] Confirm reduced-motion / fallback behavior is acceptable on weaker hardware.

### Do not do unless there is extra slack

- [ ] Major UI redesign
- [ ] new modeling branch
- [ ] any infrastructure work that is not required for the local static demo

## Sister

Primary owner: biology-facing validity, annotations, characterization, supporting facts

### Must do

- [ ] Verify the existing outputs are final and internally consistent:
  - `factor_annotations.json`
  - `pathway_scores.json`
  - `characterization.json`
  - `sample_info.csv`
- [ ] Prepare one short biological fact for each of the 9 cancer types used in the demo.
- [ ] Check 3-5 important selected lines and confirm the plain-English explanations are biologically defensible.
- [ ] Be ready to answer:
  - why a line was selected
  - what pathway diversity means here
  - why multi-omics beats transcriptomics alone

### Should do if time remains

- [ ] Tighten wording in characterization outputs if any explanation sounds too generic.
- [ ] Prepare one ovarian-cancer follow-on idea for post-hackathon discussion.

## Both

Primary owner: presentation quality and handoff quality

### Must do

- [ ] Read the exact demo script out loud once each.
- [ ] Agree on the one-sentence answer to:
  - what problem this solves
  - why the result is credible
  - why the interface matters
- [ ] Decide in advance which stretch features get shown only if time is going well.
- [ ] Decide the fallback order if something glitches during the demo.

### Shared fallback order

1. Explore only
2. Explore + coverage/validation
3. Compare tab
4. Blind spot
5. Adaptive design
6. Analyze Your Data

## 5. Concrete Deliverables by Owner

### Nikhi deliverables

- Stable local demo at `localhost:3000`
- Static precomputed assets verified
- Clean 3.5-minute click path
- Optional filter-controls integration if low-risk

### Sister deliverables

- Final biology annotation artifacts
- Cancer-type fact sheet
- Selected-line explanation sanity check

### Shared deliverables

- memorized demo script
- answer bank for judges
- fallback plan

## 6. Demo-Critical File Checklist

These are the assets that matter most for the working demo:

- `frontend/public/precomputed/umap_3d.json`
- `frontend/public/precomputed/panel_all.json`
- `frontend/public/precomputed/coverage_curve.json`
- `frontend/public/precomputed/per_layer_coverage.json`
- `frontend/public/precomputed/validation.json`
- `frontend/public/precomputed/blindspot.json`
- `frontend/public/precomputed/embeddings.json`
- `frontend/public/precomputed/adaptive_design.json`
- `frontend/public/precomputed/protein_expression.json`
- `frontend/public/precomputed/pathway_scores.json`
- `frontend/public/precomputed/characterization.json`
- `frontend/public/precomputed/factor_annotations.json`

If these are intact, the demo is mostly safe even if the backend is off.

## 7. Priority Order From Now

1. Protect the static demo path.
2. Confirm scientific story is coherent.
3. Rehearse the exact demo.
4. Only then do low-risk product polish.
5. Skip model upgrades unless the above is already finished.

## 8. Suggested Immediate Next Moves

### Nikhi

1. Run the app and click through the full demo flow.
2. Decide whether wiring `FilterControls.tsx` is a tiny diff or a trap.
3. Lock the default panel size and demo sequence.

### Sister

1. Review characterization wording for the top demo lines.
2. Write the 9 cancer-type facts.
3. Practice concise biology answers for judges.

### Both

1. Do one timed rehearsal.
2. Cut any optional steps that make the talk run long.
3. Keep the story centered on: fewer lines, same information, validated by drug response.

## 9. One-Line Strategy

Win on reliability and clarity: a working static demo, a defensible quantitative result, and a story every judge understands in under 30 seconds.

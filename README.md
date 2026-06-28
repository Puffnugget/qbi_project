# QBI Project

This repo contains a Folklore demo: a simulator that picks the next drug to test against a mixed tumor.

## What the model does

The ensemble is not the thing producing biology. It is the planner that ranks which drug to test next.

1. Each candidate drug gets an input row made from the tumor omics features and drug metadata.
2. Five small neural nets predict:
   - `mean`: expected response
   - `std`: uncertainty
3. The active learner prefers drugs with low predicted response and useful uncertainty.
4. The simulator still returns the actual response from the landmark matrix.

## What the saved files mean

- `processed_data/folklore/folklore_ensemble.pt`: the trained model weights.
- `processed_data/folklore/predictions.parquet`: the exported full-grid predictions the app reads at runtime.
- `frontend/public/precomputed/folklore.json`: canned demo rollouts built from the simulator and predictions.

## Why the demo works without the GPU

The GPU is only needed to train the ensemble.

After training, the demo uses the saved prediction file and canned JSON on CPU. That means the live app can run with no GPU if the trained artifacts are already present.

## If you want it truly live

The app can already run a live screening loop against the backend simulator, but the model scoring is currently loaded from the exported predictions file. To make the planner itself recompute from the checkpoint at request time, the backend would need to load the weights and run inference on demand instead of reading `predictions.parquet`.

## Useful commands

```bash
python scripts/export_folklore_train_features.py
python scripts/train_folklore_ensemble.py --epochs 400
python scripts/verify_phase2_folklore.py
python scripts/generate_folklore.py
```

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

## Work Split

### You

Own the environment and frontend.

Build:

- RL-style environment
- agent policies
- rollout JSON generation
- FastAPI endpoint
- frontend demo tab
- live replay controls

Your main goal:

> Make the demo feel like an adaptive experiment happening live.

### Sister

Own biology, data, and GPU model.

Build:

- verify drug-response direction
- choose good landmark compounds
- clean compound mechanism labels
- train the PyTorch ensemble on RunPod
- export predictions and uncertainty
- write biological explanations for demo tumors

Her main goal:

> Make the tumor mixtures and drug explanations biologically believable.

## Data And Interfaces

Use existing data:

- `processed_data/pca/fused_matrix.csv`
- `processed_data/log_zscored/drug_activity_log_zscored.csv`
- `processed_data/clean/drug_activity_landmark_metadata.csv`
- `processed_data/sample_info.csv`

Add one generated file:

```text
frontend/public/precomputed/folklore.json
```

Add one endpoint:

```text
GET /folklore
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

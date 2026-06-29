# TINA - Tumor Intelligence & Neoplastic Analysis

This repository contains the TINA demo: a simulator and active-learning recommendation engine designed to optimize drug screening order against heterogeneous, subclone-mixed tumors.

---

## The Demo Flow (From Scratch)

### Step 0: The Raw Data
The baseline for this project is the **NCI-60 dataset**, which consists of 60 human cancer cell lines (real cells growing in lab dishes) across 9 different cancer types (breast, colon, lung, etc.). NIH researchers tested ~150 drugs on each of these cell lines and measured the response.
- Each data point in this 60×150 grid is a **z-score**.
- **Negative values** indicate that the drug worked (the cell line is sensitive/died). For example, a z-score of `-2` is a strong drug response.
- **Positive values** indicate resistance/no response. For example, a z-score of `+1` means the drug did nothing.
- This is the **ground truth landmark matrix**. There is no model or AI here—just raw, historical lab measurements.

### Step 1: The Premise (Why the Demo Exists)
Real patient tumors are rarely composed of a single cell type. Instead, they are **heterogeneous**—containing multiple distinct subpopulations of cells (subclones), each with different genetic variations and drug sensitivities.
- The standard clinical approach treats a tumor as a homogeneous average.
- The average can hide critical resistant subclones. For example, Drug A might kill 80% of the cells, but the remaining 20% are completely resistant. The drug appears to work initially, but the tumor eventually regrows from the surviving subclones.
- **The Core Question:** Given a budget of just 6 experiments, which sequence of drugs should you test to detect and flag these resistant clones as quickly as possible?

### Step 2: Modeling the Tumor as a Mixture
The user defines a synthetic heterogeneous tumor in the UI by selecting 2 to 4 NCI-60 cell lines and assigning proportions. For example:
- **Breast Tumor Mixture:**
  - 45% $\rightarrow$ `BR:MCF7`
  - 35% $\rightarrow$ `BR:T-47D`
  - 20% $\rightarrow$ `BR:MDA-MB-231`

When you "test" a drug against this mixture, the backend simulator calculates the weighted average response across the subclones using the NCI-60 landmark matrix.
- If Drug X has responses MCF7 = `+0.78`, T-47D = `+0.71`, and MDA-MB-231 = `-1.61`:
  $$\text{Mixed Response} = (0.45 \times +0.78) + (0.35 \times +0.71) + (0.20 \times -1.61) = +0.28$$
- Although the overall average response is positive (`+0.28` — indicating a poor drug), the `BR:MDA-MB-231` subclone is actually highly sensitive (`-1.61`). The average hides this subclone-specific sensitivity. This is the exact clinical blindspot Folklore is built to identify.

### Step 3: The Budget Problem (RL / Bandit Context)
With 150 candidate drugs and a strict budget of only 6 experiments, we cannot test everything. After running each experiment, we observe the result and decide which drug to test next.
- This is a sequential decision-making problem modeled as a **Multi-Armed Bandit** (a subset of reinforcement learning).
- Each drug represents an "arm" of the bandit.
- Testing a drug yields a reward (the observed mixed response).
- The goal is to discover the best drug candidates and map the subclone sensitivities under a limited number of pulls (budget).

### Step 4: The Four Selection Policies
The demo compares four strategies side-by-side:
1. **Random:** Selects drugs entirely at random. This is the baseline control.
2. **Greedy:** Uses the ground truth data directly to pick the drug with the lowest average response across the mixture's subclones. This is pure exploitation and does not account for subclone-specific variance.
3. **Uncertainty:** Picks the drug where the subclones disagree the most (i.e., highest spread/std dev of responses). The goal is not to find a good drug, but to maximize learning about the tumor's heterogeneity.
4. **Active Learner:** An RL-flavored Upper Confidence Bound (UCB) policy that scores each untested drug at step $t$ using the formula:
   $$\text{Score}(\text{drug}) = -(\text{predicted mean response}) + 0.35 \times (\text{predicted uncertainty})$$
   - **Exploitation:** $-(\text{predicted mean response})$ rewards drugs predicted to work well.
   - **Exploration:** $0.35 \times (\text{predicted uncertainty})$ rewards drugs with high model disagreement.
   - This balances testing known good candidates vs exploring unknown, high-uncertainty areas.

### Step 5: The Ensemble ML Model
The **Active Learner** relies on a pre-trained **5-MLP Neural Network Ensemble** to predict the mean response and uncertainty of untested drugs.
- Each MLP is a Multi-Layer Perceptron trained on NCI-60 omics features and drug properties.
- **Input Feature Vector (276 dims):** Concatenation of cell line biology (150+ PCA components from RNA, protein, methylation, and histone data) and drug features (one-hot encoded mechanism classes and FDA approval status).
- **Output:** Predicted drug response z-score.
- Five identical networks were trained independently using different random seeds. The mean output across the five models represents the ensemble's prediction, and the standard deviation (disagreement) represents the model's uncertainty.
  - Model 1: predicts `-0.6`
  - Model 2: predicts `-0.9`
  - Model 3: predicts `-0.4`
  - Model 4: predicts `-1.1`
  - Model 5: predicts `-0.7`
  - **Ensemble Mean:** `-0.74` (highly promising)
  - **Ensemble Std Dev (Uncertainty):** `0.24` (moderate uncertainty)

### Step 6: Walkthrough of an Episode
Let's trace one run (episode) using the breast tumor mixture (MCF7 45%, T-47D 35%, MDA-MB-231 20%), a budget of 6, and the **Active Learner** policy:
1. **Step 1:** The Active Learner evaluates all 150 drugs using the ensemble model. Drug A gets the highest score (`-(-0.74) + 0.35 * 0.24 = 0.824`) and is selected.
2. **Observation:** The simulator looks up the ground truth and reveals Drug A's actual mixed response is `-0.45`. The engine records this and identifies which subclones responded or remained resistant.
3. **Steps 2-6:** The engine re-evaluates the remaining drugs and sequentially selects the next 5 candidates.
4. **Output:** The final screen displays the best drug found (e.g., Nocodazole, mixed response `-1.2`) and flags any subclones that remained resistant (e.g., "MDA-MB-231 subclone stayed resistant"). This provides critical clinical guidance for combination therapies.

---

## Live Neural Network Inference

### What "Live from the Model" Means
- **Before:** The ensemble's predictions were pre-computed and stored in a static table (`predictions.parquet`). The Active Learner was doing simple table lookups.
- **Now:** The static table lookup is gone. During a screening episode, the backend loads the exported network weights and runs the forward pass of all five MLPs dynamically in Python for every candidate drug at each step. 
- Inference is implemented in **pure NumPy** (`numpy`), making it incredibly fast and lightweight. It runs on the CPU in the API without requiring a GPU during the live demo.

### Model Status Endpoint
The API includes an endpoint `GET /folklore/model-status` implemented in [main.py](file:///Users/nikhi/qbi_project/api/main.py) which returns details about the active prediction source:
```json
{
  "source": "live_ensemble",
  "n_models": 5,
  "n_feature_cols": 276,
  "n_cell_lines": 60,
  "n_drugs": 150,
  "weights_file": "folklore_ensemble_weights.npz",
  "weights_size_kb": 809
}
```

---

## Key Files & Structure

- **Inference Engine:** [ensemble.py](file:///Users/nikhi/qbi_project/src/folklore/ensemble.py) implements the numpy forward pass of the MLPs and loads exported weights.
- **Predictions Wrapper:** [predictions.py](file:///Users/nikhi/qbi_project/src/folklore/predictions.py) interfaces between the active learner and the live ensemble/parquet fallback.
- **Web API:** [main.py](file:///Users/nikhi/qbi_project/api/main.py) hosts the API endpoints, including the `/folklore/model-status` route.
- **Numpy Weights Export:** [export_ensemble_numpy.py](file:///Users/nikhi/qbi_project/scripts/export_ensemble_numpy.py) converts the PyTorch checkpoint (`folklore_ensemble.pt`) into lightweight numpy matrices.

---

## Running the Pipeline & Verification

To train, export, and verify the pipeline, use the following commands:

```bash
# 1. Export features for training
python scripts/export_folklore_train_features.py

# 2. Train the 5-MLP ensemble (requires PyTorch)
python scripts/train_folklore_ensemble.py --epochs 400

# 3. Export model weights to pure-numpy format
python scripts/export_ensemble_numpy.py

# 4. Verify Phase 2 correctness and policy comparisons
python scripts/verify_phase2_folklore.py

# 5. Generate cache files for frontend demo
python scripts/generate_folklore.py
```

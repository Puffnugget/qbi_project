"""Train a 5-MLP Folklore ensemble and export full-grid predictions."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[1]
TRAIN = ROOT / "processed_data" / "folklore" / "train_features.parquet"
PREDICTIONS = ROOT / "processed_data" / "folklore" / "predictions.parquet"
CHECKPOINT = ROOT / "processed_data" / "folklore" / "folklore_ensemble.pt"


class MLP(nn.Module):
    def __init__(self, width: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(width, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


def split_cells(cells: np.ndarray, seed: int) -> tuple[set[str], set[str]]:
    rng = np.random.default_rng(seed)
    shuffled = np.asarray(cells, dtype=str).copy()
    rng.shuffle(shuffled)
    n_val = max(1, round(len(shuffled) * 0.2))
    return set(shuffled[n_val:]), set(shuffled[:n_val])


def train_one(
    frame: pd.DataFrame,
    feature_cols: list[str],
    train_cells: set[str],
    seed: int,
    epochs: int,
    device: torch.device,
) -> tuple[MLP, np.ndarray, np.ndarray]:
    torch.manual_seed(seed)
    train = frame[frame["cell_line"].isin(train_cells) & frame["response"].notna()]
    x_train = train[feature_cols].to_numpy(np.float32)
    y_train = train["response"].to_numpy(np.float32)
    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0)
    std[std == 0] = 1

    ds = TensorDataset(
        torch.tensor((x_train - mean) / std),
        torch.tensor(y_train),
    )
    loader = DataLoader(ds, batch_size=256, shuffle=True)
    model = MLP(len(feature_cols)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    loss_fn = nn.MSELoss()
    for _ in range(epochs):
        model.train()
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            opt.step()
    return model.cpu(), mean, std


def predict(model: MLP, frame: pd.DataFrame, feature_cols: list[str], mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    model.eval()
    x = torch.tensor((frame[feature_cols].to_numpy(np.float32) - mean) / std)
    with torch.no_grad():
        return model(x).numpy()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=400)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    frame = pd.read_parquet(TRAIN)
    feature_cols = [c for c in frame.columns if c not in {"cell_line", "drug", "response"}]
    train_cells, val_cells = split_cells(frame["cell_line"].unique(), args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    preds = []
    state = {"feature_cols": feature_cols, "models": [], "train_cells": sorted(train_cells), "val_cells": sorted(val_cells)}
    for i in range(5):
        model, mean, std = train_one(frame, feature_cols, train_cells, args.seed + i, args.epochs, device)
        preds.append(predict(model, frame, feature_cols, mean, std))
        state["models"].append({"model": model.state_dict(), "mean": mean, "std": std})

    pred = np.vstack(preds)
    out = frame[["cell_line", "drug"]].copy()
    out["mean"] = pred.mean(axis=0)
    out["std"] = pred.std(axis=0)
    PREDICTIONS.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(PREDICTIONS, index=False)
    torch.save(state, CHECKPOINT)

    val = (frame["cell_line"].isin(val_cells) & frame["response"].notna()).to_numpy()
    rmse = float(np.sqrt(np.mean((out.loc[val, "mean"].to_numpy() - frame.loc[val, "response"].to_numpy()) ** 2)))
    print(f"device={device} val_cells={len(val_cells)} val_rmse={rmse:.4f}")
    print(f"wrote {PREDICTIONS}")
    print(f"wrote {CHECKPOINT}")


if __name__ == "__main__":
    main()

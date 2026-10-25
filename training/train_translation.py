"""Research baseline. Requires real extracted features and reviewed manifests.

No accuracy claim or training artifact is produced without training data.
"""

import argparse
import hashlib
import json
import random
import re
from pathlib import Path
import numpy as np
import torch
from torch import nn
from backend.app.features import preprocess, PREPROCESSING
from backend.app.schemas import SCHEMA
from training.model import Translator
from training.prepare_data import validate_manifest

SPECIAL = ["<pad>", "<bos>", "<eos>", "<unk>"]


def tokenize(text):
    return re.findall(r"\w+|[^\w\s]", text.casefold())


def load_features(row):
    with np.load(row["_feature_path"], allow_pickle=False) as f:
        if str(f["schema_version"]) != SCHEMA:
            raise ValueError(
                "Feature schema mismatch; re-extract using shared configuration"
            )
        return preprocess(f["landmarks"], f["validity_mask"], f["timestamps_ms"])


def train(manifest, output, epochs, seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    rows = validate_manifest(manifest)
    train_rows = [r for r in rows if r["split"] == "train"]
    val_rows = [r for r in rows if r["split"] == "validation"]
    vocabulary = SPECIAL + sorted(
        {w for r in train_rows for w in tokenize(r["translation"])} - set(SPECIAL)
    )
    ids = {w: i for i, w in enumerate(vocabulary)}
    # Only the training split contributes vocabulary and gradient updates.
    cache = {r["video_id"]: load_features(r) for r in rows if r["split"] != "test"}
    architecture = {"width": 128, "layers": 2, "heads": 4}
    model = Translator(len(vocabulary), **architecture)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
    criterion = nn.CrossEntropyLoss(ignore_index=0)
    target = Path(output)
    target.mkdir(parents=True, exist_ok=True)
    best = float("inf")
    history = []

    def loss_for(row):
        x, t = cache[row["video_id"]]
        tokens = [1] + [ids.get(w, 3) for w in tokenize(row["translation"])] + [2]
        if len(tokens) > 65:
            raise ValueError(
                "Sentence exceeds decoder limit of 64 tokens; revise filtering/configuration"
            )
        if x.shape[0] > 240:
            raise ValueError(
                "Clip exceeds live utterance limit; segment data using annotation boundaries"
            )
        x = torch.from_numpy(x).unsqueeze(0)
        t = torch.from_numpy(t).unsqueeze(0)
        tokens = torch.tensor([tokens])
        logits = model(x, t, tokens[:, :-1])
        return criterion(logits.flatten(0, 1), tokens[:, 1:].flatten())

    for epoch in range(epochs):
        model.train()
        random.shuffle(train_rows)
        losses = []
        for row in train_rows:
            optimizer.zero_grad()
            loss = loss_for(row)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1)
            optimizer.step()
            losses.append(loss.item())
        model.eval()
        with torch.inference_mode():
            val_loss = float(np.mean([loss_for(row).item() for row in val_rows]))
        history.append(
            {
                "epoch": epoch + 1,
                "train_loss": float(np.mean(losses)),
                "validation_loss": val_loss,
            }
        )
        print(json.dumps(history[-1]))
        if val_loss < best:
            best = val_loss
            torch.save(model.state_dict(), target / "weights.pt")
    meta = {
        "version": "experimental-1",
        "schema_version": SCHEMA,
        "preprocessing": PREPROCESSING,
        "task": "direct_translation",
        "architecture": architecture,
        "vocabulary": vocabulary,
        "provenance": {
            "manifest_sha256": hashlib.sha256(Path(manifest).read_bytes()).hexdigest(),
            "seed": seed,
            "train_samples": len(train_rows),
            "signer_independent": True,
            "licenses": sorted({r["license"] for r in rows}),
        },
        "evaluation": None,
        "training_history": history,
    }
    # Serving rejects an unevaluated checkpoint. Run training.evaluate next.
    (target / "metadata.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest")
    p.add_argument("--output", required=True)
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--seed", type=int, default=42)
    a = p.parse_args()
    if a.epochs < 1:
        p.error("--epochs must be positive")
    train(a.manifest, a.output, a.epochs, a.seed)

"""Evaluate a frozen checkpoint on untouched test signers; no training here."""

import argparse
import hashlib
import json
from pathlib import Path
import torch
from sacrebleu.metrics import BLEU, CHRF
from jiwer import wer, cer
from backend.app.features import PREPROCESSING
from training.model import Translator
from training.prepare_data import validate_manifest
from training.train_translation import load_features, tokenize


def evaluate(manifest, artifact, unseen_sentences=False):
    rows = validate_manifest(manifest, unseen_sentences)
    path = Path(artifact)
    meta = json.loads((path / "metadata.json").read_text())
    if (
        hashlib.sha256(Path(manifest).read_bytes()).hexdigest()
        != meta["provenance"]["manifest_sha256"]
    ):
        raise ValueError("Evaluation manifest differs from training manifest")
    if meta["preprocessing"] != PREPROCESSING:
        raise ValueError("Preprocessing mismatch")
    model = Translator(len(meta["vocabulary"]), **meta["architecture"])
    model.load_state_dict(
        torch.load(path / "weights.pt", map_location="cpu", weights_only=True)
    )
    model.eval()
    references = []
    predictions = []
    rejected = 0
    for row in rows:
        if row["split"] != "test":
            continue
        x, t = load_features(row)
        ids, ended = model.generate(
            torch.from_numpy(x).unsqueeze(0), torch.from_numpy(t).unsqueeze(0)
        )
        valid = ended and bool(ids) and 3 not in ids
        predictions.append(
            " ".join(meta["vocabulary"][i] for i in ids) if valid else ""
        )
        rejected += not valid
        references.append(" ".join(tokenize(row["translation"])))
    b = BLEU()
    c = CHRF()
    metrics = {
        "split": "test",
        "samples": len(references),
        "signer_independent": True,
        "unseen_sentence_checked": unseen_sentences,
        "bleu": b.corpus_score(predictions, [references]).score,
        "chrf": c.corpus_score(predictions, [references]).score,
        "wer": wer(references, predictions),
        "cer": cer(references, predictions),
        "rejected": rejected,
        "human_review_completed": False,
    }
    meta["evaluation"] = metrics
    (path / "metadata.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest")
    p.add_argument("artifact")
    p.add_argument("--unseen-sentences", action="store_true")
    a = p.parse_args()
    evaluate(a.manifest, a.artifact, a.unseen_sentences)

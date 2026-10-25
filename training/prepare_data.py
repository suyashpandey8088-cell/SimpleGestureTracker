"""Validate an explicitly annotated JSONL manifest. Never invent signer IDs.

python -m training.prepare_data manifest.jsonl --report inventory.json
"""

import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from backend.app.features import preprocess
from backend.app.schemas import SCHEMA

SPLITS = {"train", "validation", "test"}


def validate_manifest(path, unseen_sentences=False):
    path = Path(path)
    rows = []
    ids = set()
    groups = {}
    signers = {}
    hashes = {}
    sentences = {}
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        required = [
            "video_id",
            "source_id",
            "signer_id",
            "split",
            "translation",
            "license",
            "landmarks_path",
        ]
        if any(not isinstance(row.get(k), str) or not row[k].strip() for k in required):
            raise ValueError(
                f"Line {line_number}: missing required metadata; unknown signer IDs cannot support independent splits"
            )
        if row.get("training_use_approved") is not True:
            raise ValueError(
                f"Line {line_number}: explicitly review and approve training use"
            )
        if row["split"] not in SPLITS or row["video_id"] in ids:
            raise ValueError("Invalid split or duplicate video_id")
        ids.add(row["video_id"])
        feature = (path.parent / row["landmarks_path"]).resolve()
        if not feature.is_file():
            raise ValueError(f"Missing features: {feature}")
        with np.load(feature, allow_pickle=False) as data:
            if (
                str(data["schema_version"]) != SCHEMA
                or data["validity_mask"].dtype != np.bool_
            ):
                raise ValueError("Invalid feature schema or non-boolean masks")
            if (
                len(data["timestamps_ms"]) < 3
                or len(data["timestamps_ms"]) > 240
                or data["timestamps_ms"][-1] - data["timestamps_ms"][0] > 24000
            ):
                raise ValueError("Feature clip exceeds live sequence limits")
            preprocess(data["landmarks"], data["validity_mask"], data["timestamps_ms"])
        digest = hashlib.sha256(feature.read_bytes()).hexdigest()
        sentence = " ".join(row["translation"].casefold().split())
        for mapping, key, label in [
            (groups, row["source_id"], "source"),
            (signers, row["signer_id"], "signer"),
            (hashes, digest, "feature hash"),
        ]:
            if key in mapping and mapping[key] != row["split"]:
                raise ValueError(f"Cross-split leakage: {label} {key}")
            mapping[key] = row["split"]
        if (
            unseen_sentences
            and sentence in sentences
            and sentences[sentence] != row["split"]
        ):
            raise ValueError("Sentence overlap in unseen-sentence evaluation")
        sentences[sentence] = row["split"]
        row["_feature_path"] = str(feature)
        rows.append(row)
    if not rows or {r["split"] for r in rows} != SPLITS:
        raise ValueError("Need nonempty train, validation, and test splits")
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--report", required=True)
    parser.add_argument("--unseen-sentences", action="store_true")
    a = parser.parse_args()
    rows = validate_manifest(a.manifest, a.unseen_sentences)
    report = {
        "videos": len(rows),
        "unique_sentences": len({r["translation"] for r in rows}),
        "signers": len({r["signer_id"] for r in rows}),
        "splits": {s: sum(r["split"] == s for r in rows) for s in sorted(SPLITS)},
        "signer_independent": True,
        "source_independent": True,
        "unseen_sentence_checked": a.unseen_sentences,
    }
    Path(a.report).write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

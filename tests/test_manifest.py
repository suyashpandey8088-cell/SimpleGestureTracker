import json
import numpy as np
import pytest
from training.prepare_data import validate_manifest


def manifest(tmp_path):
    rows = []
    for i, split in enumerate(["train", "validation", "test"]):
        p = np.zeros((4, 75, 3), np.float32)
        m = np.zeros((4, 75), bool)
        p[:, 53] = [0.4, 0.3, 0]
        p[:, 54] = [0.6, 0.3, 0]
        m[:, 53:55] = True
        p[:, 0] = [0.5 + i * 0.01, 0.5, 0]
        m[:, 0] = True
        np.savez(
            tmp_path / f"{i}.npz",
            landmarks=p,
            validity_mask=m,
            timestamps_ms=np.array([0, 100, 200, 300]),
            schema_version="isl-landmarks-v1",
        )
        rows.append(
            {
                "video_id": str(i),
                "signer_id": f"signer-{i}",
                "source_id": f"source-{i}",
                "split": split,
                "translation": f"sentence {i}",
                "license": "test-only synthetic fixture",
                "training_use_approved": True,
                "landmarks_path": f"{i}.npz",
            }
        )
    return rows


def write(tmp_path, rows):
    path = tmp_path / "manifest.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows))
    return path


def test_manifest_checks_real_features(tmp_path):
    assert len(validate_manifest(write(tmp_path, manifest(tmp_path)))) == 3


@pytest.mark.parametrize(
    "field", ["signer_id", "source_id", "landmarks_path", "translation", "license"]
)
def test_missing_metadata_rejected(tmp_path, field):
    rows = manifest(tmp_path)
    rows[0][field] = ""
    with pytest.raises(ValueError):
        validate_manifest(write(tmp_path, rows))


@pytest.mark.parametrize("field", ["signer_id", "source_id"])
def test_cross_split_group_leakage_rejected(tmp_path, field):
    rows = manifest(tmp_path)
    rows[1][field] = rows[0][field]
    with pytest.raises(ValueError, match="leakage"):
        validate_manifest(write(tmp_path, rows))


def test_duplicate_features_and_unseen_sentence_checks(tmp_path):
    rows = manifest(tmp_path)
    (tmp_path / "1.npz").write_bytes((tmp_path / "0.npz").read_bytes())
    with pytest.raises(ValueError, match="feature hash"):
        validate_manifest(write(tmp_path, rows))
    rows = manifest(tmp_path)
    rows[1]["translation"] = rows[0]["translation"]
    with pytest.raises(ValueError, match="Sentence overlap"):
        validate_manifest(write(tmp_path, rows), True)


def test_training_use_requires_explicit_approval(tmp_path):
    rows = manifest(tmp_path)
    rows[0]["training_use_approved"] = False
    with pytest.raises(ValueError, match="approve"):
        validate_manifest(write(tmp_path, rows))

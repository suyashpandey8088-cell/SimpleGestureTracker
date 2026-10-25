"""Fail-closed model loading. Import torch only when an artifact is configured."""

import json
import os
from pathlib import Path
import threading
from .features import preprocess, InsufficientTracking, PREPROCESSING
from .schemas import SCHEMA, RecognitionResponse


class ModelUnavailable(RuntimeError):
    pass


class InferenceService:
    def __init__(self, artifact_dir=None):
        self.ready = False
        self.reason = "No trained translation artifact installed"
        self.model = None
        self.meta = {}
        self.lock = threading.Lock()
        directory = (
            artifact_dir if artifact_dir is not None else os.getenv("ISL_MODEL_DIR")
        )
        if not directory:
            return
        try:
            path = Path(directory)
            meta = json.loads((path / "metadata.json").read_text())
            if (
                meta.get("schema_version") != SCHEMA
                or meta.get("preprocessing") != PREPROCESSING
                or meta.get("task") != "direct_translation"
            ):
                raise ValueError("Incompatible artifact schema, preprocessing or task")
            if not meta.get("evaluation") or not meta.get("provenance"):
                raise ValueError(
                    "Artifact must include held-out evaluation and data provenance"
                )
            vocabulary = meta["vocabulary"]
            if vocabulary[:4] != ["<pad>", "<bos>", "<eos>", "<unk>"] or len(
                vocabulary
            ) != len(set(vocabulary)):
                raise ValueError("Invalid vocabulary")
            import torch
            from training.model import Translator

            self.torch = torch
            torch.set_num_threads(int(os.getenv("ISL_TORCH_THREADS", "2")))
            self.model = Translator(len(vocabulary), **meta["architecture"])
            self.model.load_state_dict(
                torch.load(path / "weights.pt", map_location="cpu", weights_only=True)
            )
            self.model.eval()
            # Warm up both encoder and decoder before declaring readiness.
            self.model.generate(
                torch.zeros(1, 4, 525),
                torch.arange(4).float().unsqueeze(0) / 10,
                max_tokens=2,
            )
            self.meta = meta
            self.ready = True
            self.reason = ""
        except Exception as exc:
            self.model = None
            self.reason = f"Model initialization failed ({type(exc).__name__}); inspect the artifact and server configuration"

    def info(self):
        return {
            "ready": self.ready,
            "reason": self.reason or None,
            "schema_version": SCHEMA,
            "preprocessing": PREPROCESSING,
            "model_version": self.meta.get("version"),
            "input_modality": "landmarks",
            "supported_modalities": ["landmarks"],
            "points": 75,
            "max_frames": 240,
            "sample_hz": 10,
            "pose_required": True,
            "face_features": False,
            "rgb_supported": False,
            "max_utterance_ms": 24000,
            "evaluation": self.meta.get("evaluation"),
            "task": "direct_translation",
        }

    def predict(self, request):
        if not self.ready:
            raise ModelUnavailable(self.reason)
        try:
            features, times = preprocess(
                request.landmarks, request.validity_mask, request.timestamps_ms
            )
        except InsufficientTracking:
            return RecognitionResponse(
                sequence_id=request.sequence_id, status="insufficient_tracking"
            )
        if not self.lock.acquire(blocking=False):
            raise ModelUnavailable("Inference worker busy; retry shortly")
        try:
            ids, ended = self.model.generate(
                self.torch.from_numpy(features).unsqueeze(0),
                self.torch.from_numpy(times).unsqueeze(0),
            )
        finally:
            self.lock.release()
        vocab = self.meta["vocabulary"]
        if not ended or not ids or 3 in ids:
            return RecognitionResponse(
                sequence_id=request.sequence_id, status="unknown"
            )
        text = " ".join(vocab[i] for i in ids)
        return RecognitionResponse(
            sequence_id=request.sequence_id,
            status="final" if request.is_final else "interim",
            translation=text,
            is_final=request.is_final,
        )

# Model artifacts (not supplied)

Keep model weights and datasets outside Git. An inference release directory must contain:

- `metadata.json`: model schema, task, preprocessing version, vocabulary, training provenance and independent evaluation results.
- `weights.pt`: tensor-only PyTorch state dictionary.

No trained ISL translation model is included. The backend returns HTTP 503 / WebSocket `model_unavailable` until an artifact is installed. See `docs/TRANSLATION.md`.

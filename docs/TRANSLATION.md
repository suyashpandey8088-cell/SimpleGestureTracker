# Continuous ISL translation research pipeline

This adds **infrastructure and an offline training baseline**, not a working general-purpose ISL interpreter. No translated example sentences, fake confidence values, dictionary-based sentence guesses, or randomly initialized model outputs are exposed by the website.

## Readiness

| Milestone | Status |
| --- | --- |
| Data feasibility | ISLTranslate annotation inventory verified. Videos, release/license review, and signer/source metadata missing. No valid split yet. |
| Offline baseline | Extraction, validation, direct temporal Transformer training and evaluation code added. **Not trained or benchmarked.** |
| Live integration | Two-hand/body feature contract, explicit consent, bounded utterance buffer, FastAPI REST/WS, and editable transcript implemented. Missing model returns unavailable. |
| Release | Local API contract tests + frontend build/tests. No translation accuracy/latency benchmark, physical-webcam SLT validation, human review, or production inference deployment. |

The local nine-gesture mode still uses its own geometric classifier. It does not supply labels or words to the translator. Alphabet training remains a separate future feature; the alphabet dataset is not silently repurposed as sentence supervision.

## Run the frontend and API

Python 3.11, Node 22.12+ recommended. From the repository root:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --ws-max-size 2000000 --limit-concurrency 32
# Another terminal
npm ci
npm run dev
```

Open the frontend, not the backend. Vite proxies same-origin `/api/*` (including WebSocket upgrades) to the Python service. Browser code never calls localhost to reach a separate host. Set `ISL_ALLOWED_ORIGINS` to the **exact browser frontend origin(s)**, comma-separated. For an Arena preview, use the actual `https://5173-…e2b.app` preview origin shown by the platform. Do not use a wildcard.

No model is required for the health API. It deliberately returns `model_unavailable`, and no landmarks are sent after that readiness check. There are no environment secrets required for local gesture recognition.

## Feature contract: `isl-landmarks-v1`

Each frame contains **75 xyz points** in this order: Left hand (21), Right hand (21), body pose (33), plus 75 explicit boolean validity flags. Hand slots come from MediaPipe handedness, not the detection list order. Pose visibility threshold is 0.5. This version does not include facial cues.

Coordinates are unmirrored MediaPipe image coordinates, with x and z multiplied by width/height to match y units. The preview's mirror toggle never changes the model input. These are **2.5D image features, not calibrated common 3D coordinates**. Raw hand-relative world coordinates are **not** mixed with pose image coordinates. Hand depth is wrist-relative and pose depth is hip-relative; preprocessing preserves hand-local z instead of subtracting body z from it. Cross-hand/body relative depth cannot be inferred reliably from this representation. Client and extractor use the same Hand/Pose Tasks models, thresholds and slot layout. Validate actual native/browser runtime parity before training a release (native package 0.10.21, browser package 0.10.32); identical model binaries alone do not prove numerical parity.

Shared Python preprocessing (`backend/app/features.py`):

- Fixed first-valid shoulder midpoint as clip origin, shoulder width as scale. Global hand motion and inter-hand relationships are retained; wrists are not centered independently every frame.
- Two valid shoulder frames and at least 35% of frames with a visible signing hand are required. Missing tracking returns a status, not text.
- Nearest-observation resampling at 10 Hz; observations more than 200 ms away are invalid. No interpolation through tracking gaps.
- 525 features per time step: xyz (225), velocity xyz (225), validity (75). Missing coordinates and velocities are zero-filled **with explicit masks**, so zero is not interpreted as genuine observation.
- No arbitrary horizontal flips, video reversal, or inference-time augmentation.

This is a first baseline representation, not proof that landmarks retain all linguistic information. An RGB/face hybrid needs a **new versioned feature contract, licensed recordings, compatible trained encoder, privacy opt-in and separate evaluation**. Current API rejects RGB/unknown payloads; it does not pretend to support a missing modality. The inference adapter in `backend/app/inference.py` is separate from transport/UI so it can be replaced later.

## Data and extraction

Read `docs/datasets/README.md` first. Acquire data legally outside Git. Download the official model files separately (these requests send no webcam footage):

- Hand model: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- Pose model: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`

```sh
pip install -r training/requirements.txt
# Install the tested-target baseline PyTorch version appropriate for your machine:
pip install torch==2.7.0 --index-url https://download.pytorch.org/whl/cpu
python -m training.extract_landmarks /external/clips/sample.mp4 /external/features/sample.npz \
  --hand-model /external/models/hand_landmarker.task \
  --pose-model /external/models/pose_landmarker_lite.task
```

The Torch/MediaPipe/OpenCV training dependencies and real model execution have **not been installed or executed in this sandbox**. Training modules have been Python-compiled; API/NumPy preprocessing and manifest tests were executed. The PyTorch version is a reproducible target, not a claim that its end-to-end training behavior has been validated here. Record exact installed versions and model hashes with your experiment.

Create a JSONL manifest, paths relative to its location:

```json
{"video_id":"clip-001","source_id":"recording-001","signer_id":"verified-signer-01","split":"train","landmarks_path":"features/clip-001.npz","translation":"The verified English annotation.","license":"Exact dataset release and license","training_use_approved":true}
```

Optional glosses may be retained in manifests for future training, but **the current trainer does not consume gloss labels**. CTC gloss training, segmentation and hybrid gloss/translation losses are deferred. CTC can use ordered gloss labels without manual per-frame alignments; it still needs genuine gloss supervision and a feasible input/target length ratio.

```sh
python -m training.prepare_data /external/manifest.jsonl --report /external/inventory.json
# Optional stronger generalization protocol; use a pre-planned sentence-disjoint split:
python -m training.prepare_data /external/manifest.jsonl --report /external/inventory-unseen.json --unseen-sentences
```

All three splits must be populated, signer/source disjoint, and reviewed. Unknown signer IDs must not be replaced with fabricated identities to pass validation. Clips are limited to 240 observations / 24 seconds; segment longer clips only at annotation-supported boundaries. No silent truncation.

## Train and evaluate

The initial model is a small CPU-compatible temporal Transformer encoder + English autoregressive decoder (width 128, 2 layers, 4 heads), trained with teacher forcing and cross-entropy. It is a direct translation baseline, not a whole-sentence class lookup. Actual timestamps enter sinusoidal temporal embeddings. Only training examples build the vocabulary. Validation loss chooses the checkpoint; test signers are not used for optimization or selection. No augmentation is applied yet.

```sh
python -m training.train_translation /external/manifest.jsonl --output /external/artifacts/run-001 --epochs 20 --seed 42
python -m training.evaluate /external/manifest.jsonl /external/artifacts/run-001
# Add --unseen-sentences if the manifest satisfies that separate protocol.
```

Release directory contains tensor-only `weights.pt` and `metadata.json` with architecture, tokenizer/vocabulary, preprocessing version, manifest hash, license provenance, seed, loss history and held-out evaluation. Serving refuses artifacts missing evaluation or provenance. Evaluation reports BLEU, chrF, WER/CER and rejected translations; these are **automatic metrics, not semantic correctness**. Gloss WER requires a separately trained gloss model. ROUGE-L, independent human review, runtime throughput/latency and RGB/hybrid comparisons remain future benchmark work.

CPU training is intentionally small and unoptimized (per-example batches, cached features). A full large-data experiment needs profiling, streaming feature loading, padded batching and appropriate hardware. Do not infer production throughput from this baseline.

## Serve evaluated artifacts

Serving an installed artifact also requires the appropriate `torch==2.7.0` wheel (see the installation command above); the no-model health API does not.

```sh
export ISL_MODEL_DIR=/external/artifacts/run-001
export ISL_ALLOWED_ORIGINS=https://your-frontend.example
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --ws-max-size 2000000 --limit-concurrency 32
```

Only load trusted artifacts. `torch.load(weights_only=True)` limits deserialization to tensor-oriented state dictionaries; do not replace it with arbitrary pickle loading. Model warm-up runs before readiness. One global nonblocking inference lock prevents concurrent model executions. The API returns unavailable rather than queueing unlimited inference jobs.

Endpoints:

- `GET /health`: service/model readiness (HTTP 200 distinguishes a reachable but untrained service).
- `GET /model-info`: version, feature schema, supported modality and evaluation metadata.
- `POST /translate/sequence`: validated one-shot inference; HTTP 503 without a usable model.
- `WS /ws/recognize`: one utterance per socket, increasing sequence IDs, exact origin allowlist, 30-second idle timeout, 15-second inference-response timeout, 400-ms minimum request interval, bounded transport payload and 240-frame limit.

Example request keys: `schema_version`, `session_id`, `sequence_id`, `timestamps_ms`, `landmarks`, `validity_mask`, `is_final`. Use all 75 real xyz points and flags per frame; abbreviated placeholders are rejected. No raw video, audio, or screenshots are accepted. No unsolicited example sentence is returned.

The browser samples at most 10 Hz and sends cumulative overlapping windows at most once a second, with at most one request in flight. It never silently discards early signs. At the utterance limit it stops buffering and asks you to finish/restart. `Finish sentence` explicitly requests final decoding. Pauses or disappeared hands never finalize text. Only a complete final model response is appended; interim output is separate and editable corrections are allowed afterward. Unfinished/EOS-less decoding and unknown tokens are rejected. **Even EOS-complete language can be wrong:** review translations with a proficient ISL signer.

## Privacy and deployment

Local gesture mode remains on-device. Translation is a **different privacy mode**: after a separate checkbox and Connect action, hand/body landmark sequences are sent to the configured server. Landmarks are potentially identifying personal data—not anonymous simply because pixels are absent. The service does not log request bodies or save features/transcripts; deployment proxies/observability systems must likewise avoid payload logging. Transcript text stays in browser memory, not LocalStorage. Disconnect, stop/pause camera, or unmount ends transmission and clears buffered features.

Vercel still serves the static frontend. **Vercel static hosting cannot run this persistent WebSocket/PyTorch service.** Host FastAPI on a suitable Python/container host and route same-origin `/api/*` to it with WebSocket upgrade support (e.g. an authenticated reverse proxy). Development proxy config is not production infrastructure. No external inference host is provisioned by this change. Until that deployment and an evaluated, legally usable model exist, the production frontend can only show unavailable status for translation.

Use HTTPS/WSS, exact origins, authentication/access controls at the production proxy, request/body limits (2 MB), connection limits, and no payload logging. CORS/origin checking alone is not authentication. The current API is a research service, not a hardened public multitenant platform. REST has no application-level per-client rate limiter; enforce limits in the production gateway. A timeout cannot kill a running PyTorch kernel; the global lock stays held until that worker returns.

## Tests

```sh
pip install -r tests/requirements.txt
python -m pytest -q tests
npm test
npm run build
# While Vite is running; see main README for Linux shared-library requirements:
npm run test:browser
```

API tests exercise fail-closed startup, schema validation, origins, ordering, final boundaries and missing tracking. Manifest tests use clearly labeled synthetic fixtures solely to test validation; they do not create deployable weights or count as model accuracy measurements. Frontend contract tests check handedness, aspect ratio and explicit masks. Manual tests are still required for actual two-hand/pose extraction, train/serve numerical parity, a real trained model, loss convergence, complete utterances, long pauses, unseen signers, corrections, reconnection, consent withdrawal and network failure.

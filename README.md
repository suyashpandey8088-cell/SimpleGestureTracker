# GestureAI

A private, browser-based hand gesture recognition dashboard. React 19 + TypeScript + Vite, Tailwind CSS 4, Motion, Lucide, and **real MediaPipe Tasks Vision Hand Landmarker inference**. No backend, account, API key, or camera upload endpoint.

## Run locally

Requires Node.js **22.12+** (Node 24 recommended) and npm.

```sh
npm ci
npm run dev
# Open http://localhost:5173
npm test
npm run build
npm run preview
```

Use recent Chrome or Edge. Camera access requires HTTPS or localhost. On a phone, an HTTP LAN address does not qualify: use the HTTPS deployment. If an embedded preview blocks permission, open the site in its own tab.

Click **Start detection** or **Enable camera**, allow camera access, then hold one full hand in view. First start downloads Google's official ~7.8 MB hand model; allow a few seconds. A permission prompt has a 25-second timeout and model loading has a 30-second timeout, with retry/cancel actions. The sandbox has no physical camera; see the verification limits below.

## Features

- Live webcam and aligned, mirrored canvas skeleton with 21 landmarks.
- Nine rules: open palm, thumbs up/down, fist, peace, pointing, OK, rock, three fingers (index + middle + ring).
- Multi-joint **3D joint angles**, wrist-relative reach, palm-normalized distances, and thumb/index contact. Thumb direction uses camera gravity; other rules are reflection/scale invariant.
- Rolling 650 ms voting window; ≥6 samples, ≥300 ms and ≥80% agreement before confirmation. Unknown/ambiguous poses are not assigned invented labels.
- Displayed **stability** = vote agreement × joint geometry quality, **not measured accuracy or a calibrated model confidence**.
- Start/stop, pause/resume, camera selection (when multiple devices exist), mirror, landmark toggle, optional oscillator sound, expanded camera view.
- Searchable gesture library, accessible native detail dialogs, target challenges, last 10 local confirmations, clear history, session statistics.
- Responsive layout, keyboard controls, reduced-motion support, bundled fonts and WASM.

## Structure

```text
src/
  components/          Dashboard, library, permissions, camera and results
  hooks/               Recognition lifecycle, requestAnimationFrame loop, history
  services/            getUserMedia lifecycle and MediaPipe initialization
  utils/               Definitions, geometric classification, temporal smoothing, tests
  types/               Shared pose and gesture types
  App.tsx
  main.tsx
  index.css
public/wasm/           Version-matched MediaPipe 0.10.32 JS/WASM runtime
scripts/browser-check.mjs
```

Inference is synchronous and non-overlapping, throttled to at most ~22 evaluations/sec and only on new video frames. Canvas draws imperatively; UI updates are throttled. Actual FPS is measured, not simulated. Stop/unmount cancels RAF, stops every camera track, and closes the model. Generation tokens release delayed initialization results after cancellation. Each active session creates one model.

## Privacy / network behavior

Camera starts **only** from an explicit user action. No webcam frames, audio, screenshots, or video are uploaded, recorded, or saved. Sound is a locally generated beep; microphone permission is never requested. LocalStorage contains only the last 10 gesture IDs, timestamps, and stability values. Session counts are memory-only.

The app assets, fonts, and WASM are served by the site. The model is fetched by the browser from:

`https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`

This asset download exposes normal request metadata (e.g. IP address) to the asset host, but **does not send camera frames**. Internet connectivity to that host is needed on first load. To self-host, download the official task file into `public/models/hand_landmarker.task`, update `modelAssetPath` in `src/services/handLandmarker.ts`, and redeploy. Never replace the binary with a Git LFS pointer or HTML error page.

## Tests and verification

`npm test` executes 17 deterministic tests covering all nine poses, mirrored/scaled examples, invalid/unsupported poses, duration, vote rejection and reset, plus camera request, error, and track-cleanup services. These are **synthetic geometry unit tests**, not physical-camera accuracy measurements.

`npm run test:browser` runs the headless UI check against the running dev server. It covers opt-in (no camera on load), no-camera/denied-camera feedback, library search/detail dialogs, toggles, expanded view, desktop/mobile overflow and browser exceptions. The included Chromium package targets Linux; on a normal development machine you can use Playwright's installed Chromium instead. This sandbox needed the package's Amazon Linux shared libraries extracted to `/tmp/al2023/lib` and `LD_LIBRARY_PATH=/tmp/al2023/lib` when launching the check.

### Manual real-webcam acceptance checklist (still required)

1. On deployed HTTPS in Chrome/Edge, allow access. Confirm a real feed and a skeleton attached to your hand, at normal and resized dimensions.
2. Perform each gesture for ~1 second with either hand, then vary distance, background, lighting, hand rotation, and mirroring. Test fingers between folded and extended; expect unknown rather than a confident guess.
3. Test OK versus three fingers, palm versus four fingers, pointing versus thumbs-up, peace versus adjacent extended fingers. Three means index/middle/ring; other versions of the number three aren't supported.
4. Bring two hands into frame: expect “One hand at a time.” Move a hand out of frame: expect an explanatory status, not a gesture.
5. Pause/resume, toggle landmarks/mirroring/sound, expand camera, change camera if available. Pause keeps the stream active; **Stop releases the camera**. Confirm the browser camera light turns off on stop/navigation.
6. Deny permission, unplug the device, use the camera in another app, block the model URL, cancel during setup, and retry. Check loading exits with useful feedback and no abandoned tracks.
7. Confirm local history survives reload, clear history works, and session counts reset on reload. Holding the same gesture doesn't continuously add entries; a different confirmed gesture or removing the hand allows another event.
8. Check keyboard Tab/Enter/Space, `/` to focus library search, Escape to close the native dialog, screen reader result feedback, 390px mobile layout and reduced motion.

**Limitations:** real webcam/lighting/orientation recognition and deployed permission behavior cannot be verified in this camera-less sandbox. No recognition accuracy is claimed. Rule-based hand poses are conservative but not a replacement for a trained sign-language model. Heavy CPU inference may lower FPS; it stays on the main thread and has not been moved to a worker. Model loading needs connectivity. Session duration measures camera-active time, including detection pauses, rather than wall-clock app uptime.

## Deployment

Vercel: import `suyashpandey8088-cell/SimpleGestureTracker`, select **Vite**, use `npm ci`, `npm run build`, output `dist`. No environment variables. `vercel.json` supplies security headers and WASM caching. Deploy the working branch `arena/14246226-simplegesturetracker` as production if publishing this session without merging. Future default production deployments use the project's configured production branch; select this branch explicitly until it is merged.

Netlify: build `npm run build`, publish `dist`, Node 24. Serve over HTTPS and allow camera permissions. No SPA rewrites are necessary because navigation uses page anchors.

See `THIRD_PARTY_NOTICES.md` for model/runtime/font attribution.

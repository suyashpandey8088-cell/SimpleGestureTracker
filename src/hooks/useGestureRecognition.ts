import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createLandmarker, connections } from "../services/handLandmarker";
import { openCamera, stopStream, cameraError } from "../services/cameraService";
import { classify } from "../utils/gestureClassifier";
import { GestureSmoother } from "../utils/gestureSmoothing";
import { byId } from "../utils/gestureDefinitions";
import type { HistoryEntry, Prediction } from "../types/gesture";
function readHistory(): HistoryEntry[] {
  try {
    const a = JSON.parse(localStorage.getItem("gesture-history") || "[]");
    return Array.isArray(a)
      ? a
          .filter(
            (e) =>
              e &&
              byId[e.id] &&
              Number.isFinite(e.time) &&
              Number.isFinite(e.score),
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function useGestureRecognition() {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream | null>(null),
    model = useRef<HandLandmarker | null>(null),
    raf = useRef(0),
    generation = useRef(0),
    smoother = useRef(new GestureSmoother()),
    last = useRef<string | null>(null),
    audio = useRef<AudioContext | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "active" | "error">(
      "idle",
    ),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [mirror, setMirror] = useState(true),
    [landmarks, setLandmarks] = useState(true),
    [sound, setSoundState] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [prediction, setPrediction] = useState<Prediction | null>(null),
    [notice, setNotice] = useState("Waiting for camera"),
    [fps, setFps] = useState(0),
    [history, setHistory] = useState(readHistory),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [seconds, setSeconds] = useState(0),
    [detectedAt, setDetectedAt] = useState<number | null>(null);
  // Unlock audio in the button click, not in the later inference callback.
  const setSound = (enabled: boolean) => {
    if (enabled) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch {
        setSoundState(false);
        return;
      }
    }
    setSoundState(enabled);
  };
  const settings = useRef({ paused, landmarks, sound });
  settings.current = { paused, landmarks, sound };
  useEffect(() => {
    try {
      localStorage.setItem("gesture-history", JSON.stringify(history));
    } catch {
      /* Storage may be disabled. */
    }
  }, [history]);
  useEffect(() => {
    if (status !== "active") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);
  const cleanup = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(raf.current);
    stopStream(stream.current);
    stream.current = null;
    model.current?.close();
    model.current = null;
    smoother.current.reset();
    last.current = null;
    if (video.current) video.current.srcObject = null;
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }, []);
  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setPrediction(null);
    setFps(0);
    setNotice("Camera is off");
    setPaused(false);
  }, [cleanup]);
  useEffect(
    () => () => {
      cleanup();
      void audio.current?.close();
    },
    [cleanup],
  );
  const start = useCallback(
    async (selected?: string) => {
      cleanup();
      const token = generation.current;
      setStatus("loading");
      setError("");
      setPrediction(null);
      setPaused(false);
      setNotice("Preparing your workspace…");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (settings.current.sound) {
          audio.current ??= new AudioContext();
          void audio.current.resume();
        }
        const pending = openCamera(selected || device);
        pending.then(
          (s) => {
            if (generation.current !== token) stopStream(s);
          },
          () => {},
        );
        const s = await Promise.race([
          pending,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Camera permission is taking too long. Check the browser permission prompt and retry.",
                  ),
                ),
              25000,
            );
          }),
        ]);
        clearTimeout(timer);
        if (token !== generation.current) {
          stopStream(s);
          return;
        }
        stream.current = s;
        s.getVideoTracks()[0].onended = () => {
          cleanup();
          setStatus("error");
          setError("Camera disconnected. Reconnect it and start again.");
        };
        const v = video.current!;
        v.srcObject = s;
        await Promise.race([
          v.play(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Camera preview did not become ready. Please retry.",
                  ),
                ),
              15000,
            );
          }),
        ]);
        clearTimeout(timer);
        if (token !== generation.current) return;
        const pendingModel = createLandmarker();
        pendingModel.then(
          (m) => {
            if (token !== generation.current) m.close();
          },
          () => {},
        );
        const m = await Promise.race([
          pendingModel,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Hand model could not load in time. Check your connection and retry.",
                  ),
                ),
              30000,
            );
          }),
        ]);
        clearTimeout(timer);
        if (token !== generation.current) return;
        model.current = m;
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ),
        );
        if (token !== generation.current) return;
        setDevice(s.getVideoTracks()[0].getSettings().deviceId || "");
        setStatus("active");
        let previous = -1,
          processed = 0,
          tick = performance.now(),
          lastProcess = 0,
          lastUi = 0;
        function loop(now: number) {
          if (token !== generation.current) return;
          raf.current = requestAnimationFrame(loop);
          if (settings.current.paused) {
            smoother.current.reset();
            last.current = null;
            return;
          }
          if (
            now - lastProcess < 45 ||
            v.readyState < 2 ||
            v.currentTime === previous ||
            !v.videoWidth
          )
            return;
          previous = v.currentTime;
          lastProcess = now;
          try {
            const result = m.detectForVideo(v, now);
            processed++;
            const c = canvas.current!,
              ctx = c.getContext("2d")!;
            if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
              c.width = v.videoWidth;
              c.height = v.videoHeight;
            }
            ctx.clearRect(0, 0, c.width, c.height);
            if (settings.current.landmarks)
              for (const hand of result.landmarks) {
                ctx.strokeStyle = "#a3f477";
                ctx.lineWidth = 2;
                ctx.shadowColor = "#a3f477";
                ctx.shadowBlur = 6;
                for (const [a, b] of connections) {
                  ctx.beginPath();
                  ctx.moveTo(hand[a].x * c.width, hand[a].y * c.height);
                  ctx.lineTo(hand[b].x * c.width, hand[b].y * c.height);
                  ctx.stroke();
                }
                for (const p of hand) {
                  ctx.beginPath();
                  ctx.arc(p.x * c.width, p.y * c.height, 3, 0, Math.PI * 2);
                  ctx.fillStyle = "#e8ffd9";
                  ctx.fill();
                }
                ctx.shadowBlur = 0;
              }
            const single = result.landmarks.length === 1;
            const inFrame =
              single &&
              result.landmarks[0].every(
                (p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99,
              );
            const candidate = inFrame
              ? classify(result.worldLandmarks[0])
              : null;
            // Direction for thumbs-up/down must be measured in camera space, not world orientation.
            if (
              candidate &&
              (candidate.id === "up" || candidate.id === "down")
            ) {
              const h = result.landmarks[0];
              const dx = h[4].x - h[2].x,
                dy = h[4].y - h[2].y;
              if (Math.abs(dy) > Math.abs(dx) * 1.2)
                candidate.id = dy < 0 ? "up" : "down";
              else {
                candidate.score = 0;
              }
            }
            const stable = smoother.current.update(
              candidate && candidate.score > 0 ? candidate : null,
              now,
            );
            if (now - lastUi > 120) {
              setPrediction(stable);
              setNotice(
                result.landmarks.length > 1
                  ? "One hand at a time, please"
                  : !single
                    ? "Bring your hand into view"
                    : !inFrame
                      ? "Keep your entire hand inside the frame"
                      : stable
                        ? "Gesture confirmed"
                        : candidate
                          ? "Hold steady…"
                          : "Gesture not recognized",
              );
              lastUi = now;
            }
            if (stable && last.current !== stable.id) {
              last.current = stable.id;
              const time = Date.now();
              setDetectedAt(time);
              setHistory((h) => [{ ...stable, time }, ...h].slice(0, 10));
              setCounts((c) => ({
                ...c,
                [stable.id]: (c[stable.id] || 0) + 1,
              }));
              if (settings.current.sound) {
                audio.current ??= new AudioContext();
                const a = audio.current;
                void a.resume();
                const o = a.createOscillator(),
                  g = a.createGain();
                o.connect(g);
                g.connect(a.destination);
                o.frequency.value = 680;
                g.gain.setValueAtTime(0.06, a.currentTime);
                g.gain.exponentialRampToValueAtTime(
                  0.001,
                  a.currentTime + 0.12,
                );
                o.start();
                o.stop(a.currentTime + 0.13);
              }
            }
            if (!single) last.current = null;
            if (now - tick >= 1000) {
              setFps(Math.round((processed * 1000) / (now - tick)));
              processed = 0;
              tick = now;
            }
          } catch (e) {
            cleanup();
            setStatus("error");
            setError("Tracking stopped: " + cameraError(e));
            setPrediction(null);
          }
        }
        raf.current = requestAnimationFrame(loop);
      } catch (e) {
        clearTimeout(timer);
        if (token !== generation.current) return;
        cleanup();
        setStatus("error");
        setError(cameraError(e));
      }
    },
    [cleanup, device],
  );
  const togglePause = () => {
    setPaused((p) => !p);
    setPrediction(null);
    setFps(0);
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };
  return {
    video,
    canvas,
    status,
    error,
    paused,
    mirror,
    setMirror,
    landmarks,
    setLandmarks,
    sound,
    setSound,
    devices,
    device,
    start,
    stop,
    togglePause,
    prediction,
    notice,
    fps,
    history,
    clearHistory: () => setHistory([]),
    counts,
    seconds,
    detectedAt,
  };
}
export type Recognition = ReturnType<typeof useGestureRecognition>;

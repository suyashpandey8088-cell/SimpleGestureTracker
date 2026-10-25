import { useCallback, useEffect, useRef, useState } from "react";
import type {
  HandLandmarkerResult,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "../services/poseLandmarker";
import {
  makeFeatureFrame,
  sequenceRequest,
} from "../services/translationFeatures";
import { TRANSLATION_SCHEMA } from "../types/translation";
import type {
  FeatureFrame,
  TranslationModelInfo,
  TranslationResult,
} from "../types/translation";

type State = "offline" | "connecting" | "streaming" | "finishing" | "error";
const API = "/api";
export function useTranslation() {
  const [state, setState] = useState<State>("offline"),
    [message, setMessage] = useState(
      "No trained ISL translation model is bundled. Connect a configured inference service to begin.",
    ),
    [consent, setConsent] = useState(false),
    [interim, setInterim] = useState(""),
    [transcript, setTranscript] = useState(""),
    [frames, setFrames] = useState(0),
    [version, setVersion] = useState<string | null>(null);
  const runtime = useRef<{
    socket: WebSocket | null;
    pose: PoseLandmarker | null;
    frames: FeatureFrame[];
    session: string;
    id: number;
    lastFrame: number;
    lastSent: number;
    pending: number | null;
    pendingFinal: boolean;
    generation: number;
    timer: ReturnType<typeof setTimeout> | null;
    controller: AbortController | null;
  }>({
    socket: null,
    pose: null,
    frames: [],
    session: "",
    id: 0,
    lastFrame: -Infinity,
    lastSent: -Infinity,
    pending: null,
    pendingFinal: false,
    generation: 0,
    timer: null,
    controller: null,
  });
  const dispose = useCallback(() => {
    const r = runtime.current;
    r.generation++;
    r.controller?.abort();
    r.controller = null;
    if (r.timer) clearTimeout(r.timer);
    r.timer = null;
    const ws = r.socket;
    r.socket = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.close();
    }
    r.pose?.close();
    r.pose = null;
    r.frames = [];
    r.pending = null;
    r.pendingFinal = false;
    r.lastFrame = -Infinity;
    r.lastSent = -Infinity;
  }, []);
  const disconnect = useCallback(() => {
    dispose();
    setState("offline");
    setFrames(0);
    setInterim("");
    setMessage(
      "Disconnected. Landmark transmission stopped; transcript remains editable.",
    );
  }, [dispose]);
  useEffect(() => dispose, [dispose]);
  const fail = useCallback(
    (text: string) => {
      dispose();
      setState("error");
      setFrames(0);
      setInterim("");
      setMessage(text);
    },
    [dispose],
  );
  const send = useCallback(
    (final: boolean) => {
      const r = runtime.current;
      if (
        !r.socket ||
        r.socket.readyState !== WebSocket.OPEN ||
        r.pending !== null ||
        r.frames.length < 3
      )
        return false;
      const id = r.id++;
      r.pending = id;
      r.pendingFinal = final;
      r.lastSent = performance.now();
      r.socket.send(
        JSON.stringify(sequenceRequest(r.frames, r.session, id, final)),
      );
      r.timer = setTimeout(
        () =>
          fail(
            "The inference service did not respond. Reconnect to start a new utterance.",
          ),
        16000,
      );
      if (final) {
        setState("finishing");
        setMessage("Finishing sentence…");
      }
      return true;
    },
    [fail],
  );
  const connect = useCallback(async () => {
    if (!consent) return;
    dispose();
    const r = runtime.current,
      token = r.generation;
    setState("connecting");
    setInterim("");
    setFrames(0);
    setMessage("Checking service and trained model…");
    r.controller = new AbortController();
    r.timer = setTimeout(
      () =>
        fail(
          "Connection or pose-model setup timed out. Check the API route and model assets.",
        ),
      30000,
    );
    try {
      const response = await fetch(`${API}/model-info`, {
        signal: r.controller.signal,
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error(
          "Translation service is not configured. The static frontend needs a FastAPI service at /api.",
        );
      const info: TranslationModelInfo = await response.json();
      if (!info.ready)
        throw new Error(
          info.reason ||
            "Translation model is not installed. Train and evaluate an ISL model before enabling translation.",
        );
      if (
        info.schema_version !== TRANSLATION_SCHEMA ||
        info.input_modality !== "landmarks" ||
        info.preprocessing !== "body-anchor-velocity-v1" ||
        info.max_frames !== 240 ||
        info.max_utterance_ms !== 24000 ||
        info.sample_hz !== 10
      )
        throw new Error(
          "The inference model uses an incompatible feature contract.",
        );
      const pose = await createPoseLandmarker();
      if (token !== r.generation) {
        pose.close();
        return;
      }
      r.pose = pose;
      setVersion(info.model_version);
      const url = new URL(`${API}/ws/recognize`, location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(url);
      r.socket = socket;
      r.session = crypto.randomUUID();
      r.id = 0;
      socket.onopen = () => {
        if (token !== r.generation) return;
        if (r.timer) clearTimeout(r.timer);
        r.timer = null;
        setState("streaming");
        setMessage(
          "Streaming hands and body landmarks. Finish the sentence explicitly; pauses do not end it.",
        );
      };
      socket.onerror = () => {
        if (token === r.generation)
          fail(
            "Could not connect to the inference WebSocket. Check the API proxy and allowed origin.",
          );
      };
      socket.onclose = () => {
        if (token === r.generation)
          fail(
            "Translation connection closed. Reconnect to begin a new sentence.",
          );
      };
      socket.onmessage = (event) => {
        if (token !== r.generation) return;
        try {
          const result = JSON.parse(event.data) as TranslationResult & {
            error?: string;
            message?: string;
          };
          if (result.error) {
            fail(result.message || result.error);
            return;
          }
          if (result.sequence_id !== r.pending) return;
          if (r.timer) clearTimeout(r.timer);
          r.timer = null;
          r.pending = null;
          if (
            !["interim", "final", "unknown", "insufficient_tracking"].includes(
              result.status,
            ) ||
            typeof result.translation !== "string"
          )
            throw new Error("Invalid inference response");
          if (result.status === "final" && result.is_final && r.pendingFinal) {
            setTranscript((t) =>
              [t.trim(), result.translation.trim()].filter(Boolean).join(" "),
            );
            disconnect();
            setMessage(
              "Sentence appended to the editable transcript. Review its meaning; this model is experimental.",
            );
          } else if (r.pendingFinal) {
            fail(
              "The model could not produce a complete sentence. No text was appended.",
            );
          } else if (result.status === "interim" && !result.is_final) {
            setInterim(result.translation);
            setMessage("Interim prediction — not yet added to the transcript.");
          } else {
            setInterim("");
            setMessage(
              result.status === "insufficient_tracking"
                ? "Keep your signing hands and both shoulders visible. Pauses will not finalize a sentence."
                : "No supported translation yet. Nothing has been added to the transcript.",
            );
          }
        } catch {
          fail("The inference service returned an invalid response.");
        }
      };
    } catch (error) {
      if (token === r.generation)
        fail(
          error instanceof Error
            ? error.message
            : "Unable to connect to translation service.",
        );
    }
  }, [consent, dispose, fail, disconnect]);
  const onFrame = useCallback(
    (hands: HandLandmarkerResult, video: HTMLVideoElement, now: number) => {
      const r = runtime.current;
      if (
        !r.pose ||
        r.socket?.readyState !== WebSocket.OPEN ||
        r.pendingFinal ||
        now - r.lastFrame < 100
      )
        return;
      if (
        r.frames.length >= 240 ||
        (r.frames.length && now - r.frames[0].timestamp > 24000)
      ) {
        setMessage(
          "Utterance limit reached. Click Finish sentence, or disconnect to discard and restart.",
        );
        return;
      }
      try {
        r.lastFrame = now;
        const pose = r.pose.detectForVideo(video, now);
        r.frames.push(
          makeFeatureFrame(
            hands,
            pose,
            video.videoWidth / video.videoHeight,
            now,
          ),
        );
        setFrames(r.frames.length);
        // Cumulative windows overlap without dropping the start of the sentence.
        if (
          r.frames.length >= 5 &&
          now - r.lastSent >= 1000 &&
          r.pending === null
        )
          send(false);
        return pose.landmarks[0];
      } catch {
        fail(
          "Pose tracking failed. Disconnect and retry; local gesture recognition is unaffected.",
        );
      }
    },
    [fail, send],
  );
  const finish = () => {
    if (!send(true))
      setMessage(
        runtime.current.pending !== null
          ? "Wait for the current prediction to finish, then click Finish sentence."
          : "Capture at least three frames before finishing.",
      );
  };
  const allow = (value: boolean) => {
    setConsent(value);
    if (!value) disconnect();
  };
  return {
    state,
    message,
    consent,
    setConsent: allow,
    interim,
    transcript,
    setTranscript,
    frames,
    version,
    connect,
    disconnect,
    finish,
    onFrame,
  };
}
export type Translation = ReturnType<typeof useTranslation>;

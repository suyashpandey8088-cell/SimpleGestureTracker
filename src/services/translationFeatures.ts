import type {
  HandLandmarkerResult,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { FeatureFrame, SequenceRequest } from "../types/translation";
import { TRANSLATION_SCHEMA } from "../types/translation";
/** Camera-space, pre-preview-mirror coordinates. Never recenter individual hands. */
export function makeFeatureFrame(
  hands: HandLandmarkerResult,
  pose: PoseLandmarkerResult,
  aspect: number,
  timestamp: number,
): FeatureFrame {
  const points: [number, number, number][] = Array.from({ length: 75 }, () => [
    0, 0, 0,
  ]);
  const mask = Array<boolean>(75).fill(false),
    scores = new Map<number, number>();
  hands.landmarks.forEach((hand, i) => {
    const category = hands.handedness[i]?.[0];
    if (!category) return;
    const slot = category.categoryName === "Left" ? 0 : 21;
    if ((scores.get(slot) ?? -1) >= category.score) return;
    scores.set(slot, category.score);
    hand.forEach((p, k) => {
      points[slot + k] = [p.x * aspect, p.y, p.z * aspect];
      mask[slot + k] = true;
    });
  });
  pose.landmarks[0]?.forEach((p, k) => {
    points[42 + k] = [p.x * aspect, p.y, p.z * aspect];
    mask[42 + k] = p.visibility >= 0.5;
  });
  return { timestamp, points, mask };
}
export function sequenceRequest(
  frames: FeatureFrame[],
  session: string,
  id: number,
  isFinal: boolean,
): SequenceRequest {
  return {
    schema_version: TRANSLATION_SCHEMA,
    session_id: session,
    sequence_id: id,
    timestamps_ms: frames.map((f) => f.timestamp - frames[0].timestamp),
    landmarks: frames.map((f) => f.points),
    validity_mask: frames.map((f) => f.mask),
    is_final: isFinal,
  };
}

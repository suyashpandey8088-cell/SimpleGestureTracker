import { describe, it, expect } from "vitest";
import { makeFeatureFrame, sequenceRequest } from "./translationFeatures";
import type {
  HandLandmarkerResult,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
describe("translation input contract", () => {
  it("keeps hand identity, camera-space motion, aspect ratio and missing masks", () => {
    const hand = Array.from({ length: 21 }, () => ({
      x: 0.25,
      y: 0.5,
      z: 0.1,
    }));
    const hands = {
      landmarks: [hand],
      handedness: [[{ categoryName: "Right", score: 0.9 }]],
      worldLandmarks: [],
    } as unknown as HandLandmarkerResult;
    const f = makeFeatureFrame(
      hands,
      { landmarks: [] } as unknown as PoseLandmarkerResult,
      2,
      1000,
    );
    expect(f.points).toHaveLength(75);
    expect(f.mask.slice(0, 21).every((x) => !x)).toBe(true);
    expect(f.points[21]).toEqual([0.5, 0.5, 0.2]);
    expect(f.mask[21]).toBe(true);
    expect(f.mask[53]).toBe(false);
    const q = sequenceRequest(
      [f, { ...f, timestamp: 1100 }, { ...f, timestamp: 1200 }],
      "session",
      3,
      false,
    );
    expect(q.timestamps_ms).toEqual([0, 100, 200]);
    expect(q.is_final).toBe(false);
    expect(q.schema_version).toBe("isl-landmarks-v1");
  });
});

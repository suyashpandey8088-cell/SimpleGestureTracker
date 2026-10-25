import { describe, it, expect } from "vitest";
import { classify } from "./gestureClassifier";
import { GestureSmoother } from "./gestureSmoothing";
import type { Point, GestureId } from "../types/gesture";
function pose(states: number[], thumb = false): Point[] {
  const p: Point[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  p[1] = { x: -0.35, y: -0.3, z: 0 };
  p[2] = { x: -0.5, y: -0.65, z: 0 };
  p[3] = { x: -0.25, y: -0.6, z: 0 };
  p[4] = { x: -0.2, y: -0.5, z: 0 };
  if (thumb) {
    p[1] = { x: -0.7, y: -0.3, z: 0 };
    p[2] = { x: -0.7, y: -0.7, z: 0 };
    p[3] = { x: -0.7, y: -1.15, z: 0 };
    p[4] = { x: -0.7, y: -1.6, z: 0 };
  }
  states.forEach((s, k) => {
    const b = 5 + k * 4,
      x = (k - 1) * 0.38;
    p[b] = { x, y: -1, z: 0 };
    p[b + 1] = { x, y: -1.45, z: 0 };
    p[b + 2] = { x, y: s ? -1.8 : -1.1, z: 0 };
    p[b + 3] = { x, y: s ? -2.1 : -0.8, z: 0 };
  });
  return p;
}
describe("geometric gesture rules", () => {
  const examples: [GestureId, number[], boolean][] = [
    ["palm", [1, 1, 1, 1], true],
    ["up", [0, 0, 0, 0], true],
    ["fist", [0, 0, 0, 0], false],
    ["peace", [1, 1, 0, 0], false],
    ["point", [1, 0, 0, 0], false],
    ["rock", [1, 0, 0, 1], false],
    ["three", [1, 1, 1, 0], false],
  ];
  for (const [id, f, t] of examples) {
    it(`recognizes ${id} and mirrored/scaled variants`, () => {
      const p = pose(f, t);
      expect(classify(p)?.id).toBe(id);
      expect(
        classify(
          p.map((q) => ({
            x: -q.x * 0.1 + 0.4,
            y: q.y * 0.1 + 0.5,
            z: q.z * 0.1,
          })),
        )?.id,
      ).toBe(id);
    });
  }
  it("recognizes thumbs down", () => {
    expect(
      classify(pose([0, 0, 0, 0], true).map((q) => ({ ...q, y: -q.y })))?.id,
    ).toBe("down");
  });
  it("recognizes an OK circle", () => {
    const p = pose([0, 1, 1, 1]);
    p[4] = { ...p[8] };
    expect(classify(p)?.id).toBe("ok");
  });
  it("rejects invalid, tiny and unsupported poses", () => {
    expect(classify([])).toBeNull();
    expect(classify(pose([0, 1, 0, 0]))).toBeNull();
    expect(
      classify(pose([1, 1, 1, 1]).map((q) => ({ ...q, x: NaN }))),
    ).toBeNull();
    expect(classify(Array(21).fill({ x: 0, y: 0, z: 0 }))).toBeNull();
  });
});
describe("temporal smoothing", () => {
  it("requires duration and agreement, and bridges only short dropouts", () => {
    const s = new GestureSmoother(),
      p = { id: "palm" as const, score: 0.9 };
    for (let t = 0; t < 300; t += 50) expect(s.update(p, t)).toBeNull();
    expect(s.update(p, 350)?.id).toBe("palm");
    expect(s.update(null, 400)?.id).toBe("palm");
    expect(s.update(null, 650)).toBeNull();
    s.reset();
    expect(s.update(p, 500)).toBeNull();
  });
  it("rejects alternating labels", () => {
    const s = new GestureSmoother();
    for (let t = 0; t < 1500; t += 50)
      expect(
        s.update({ id: t % 100 === 0 ? "palm" : "fist", score: 1 }, t),
      ).toBeNull();
  });
});

describe("recognition regressions", () => {
  it("accepts naturally bent extended fingers rather than requiring perfect joints", () => {
    const p = pose([1, 1, 1, 1], true);
    for (const b of [5, 9, 13, 17]) {
      p[b + 2].x += 0.16;
      p[b + 3].x += 0.28;
    }
    expect(classify(p)?.id).toBe("palm");
  });
  it("does not require a tucked thumb for pointing or three fingers", () => {
    expect(classify(pose([1, 0, 0, 0], true))?.id).toBe("point");
    expect(classify(pose([1, 1, 1, 0], true))?.id).toBe("three");
  });
  it("does not reject valid world landmarks because of an absolute hand size cutoff", () => {
    expect(
      classify(
        pose([1, 1, 1, 1], true).map((p) => ({
          x: p.x * 0.005,
          y: p.y * 0.005,
          z: p.z * 0.005,
        })),
      )?.id,
    ).toBe("palm");
  });
  it("uses image coordinates for thumb direction before rejecting the pose", () => {
    const camera = pose([0, 0, 0, 0], true);
    const rotated = camera.map((p) => ({ x: -p.y, y: p.x, z: p.z }));
    expect(classify(rotated, camera)?.id).toBe("up");
  });
  it("confirms a stable gesture at 3 FPS", () => {
    const s = new GestureSmoother();
    expect(s.update({ id: "palm", score: 0.9 }, 0)).toBeNull();
    expect(s.update({ id: "palm", score: 0.9 }, 333)).toBeNull();
    expect(s.update({ id: "palm", score: 0.9 }, 666)?.id).toBe("palm");
  });
  it("recovers from a missing observation without permanently losing confirmation", () => {
    const s = new GestureSmoother();
    for (let t = 0; t <= 600; t += 100) s.update({ id: "palm", score: 0.9 }, t);
    expect(s.update(null, 700)?.id).toBe("palm");
    expect(s.update({ id: "palm", score: 0.9 }, 800)?.id).toBe("palm");
    s.reset();
    expect(s.update(null, 900)).toBeNull();
  });
});

it("keeps half-curled and degenerate poses unknown", () => {
  const p = pose([1, 0, 0, 0]);
  p[7] = { x: p[5].x + 0.25, y: -1.7, z: 0 };
  p[8] = { x: p[5].x + 0.4, y: -1.95, z: 0 };
  expect(classify(p)).toBeNull();
  const broken = pose([0, 0, 0, 0]);
  broken[6] = { ...broken[5] };
  broken[7] = { ...broken[5] };
  broken[8] = { ...broken[5] };
  expect(classify(broken)).toBeNull();
});

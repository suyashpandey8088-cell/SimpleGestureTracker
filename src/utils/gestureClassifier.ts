import type { Point, Prediction, GestureId } from "../types/gesture";
const dist = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function angle(a: Point, b: Point, c: Point) {
  const u = [a.x - b.x, a.y - b.y, a.z - b.z],
    v = [c.x - b.x, c.y - b.y, c.z - b.z];
  return (
    (Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          u.reduce((s, n, i) => s + n * v[i], 0) /
            (Math.hypot(...u) * Math.hypot(...v) || 1),
        ),
      ),
    ) *
      180) /
    Math.PI
  );
}
/** Local 3D angles and palm-normalized distances are invariant to translation,
 * scale and reflection. Only thumbs-up/down intentionally use image gravity. */
export function classify(
  p: Point[],
  cameraPoints: Point[] = p,
): Prediction | null {
  if (p.length !== 21 || p.some((q) => ![q.x, q.y, q.z].every(Number.isFinite)))
    return null;
  const size = dist(p[0], p[9]);
  if (size < 1e-6) return null;
  const fingers = [5, 9, 13, 17].map((b) => {
    const a = angle(p[b], p[b + 1], p[b + 2]),
      d = angle(p[b + 1], p[b + 2], p[b + 3]);
    const reach = dist(p[b + 3], p[0]) / dist(p[b], p[0]);
    // A naturally extended finger is not perfectly straight. Check both joints
    // and the whole finger's chord/path ratio instead of demanding >155°.
    const path =
      dist(p[b], p[b + 1]) +
      dist(p[b + 1], p[b + 2]) +
      dist(p[b + 2], p[b + 3]);
    if (path < size * 0.05) return -1;
    const straightness = dist(p[b], p[b + 3]) / path;
    if (a > 140 && d > 135 && straightness > 0.88 && reach > 1.18) return 1;
    if ((a < 125 || reach < 1.05) && straightness < 0.85) return 0;
    return -1; // Half-curled fingers remain unknown, not guessed.
  });
  const [i, m, r, l] = fingers;
  const thumb = angle(p[2], p[3], p[4]) > 140 && dist(p[4], p[5]) / size > 0.42;
  const touch = dist(p[4], p[8]) / size;
  let id: GestureId | undefined;
  if (touch < 0.27 && m === 1 && r === 1 && l === 1) id = "ok";
  else if (fingers.includes(-1)) return null;
  else if (i && m && r && l && thumb) id = "palm";
  else if (!i && !m && !r && !l) {
    if (thumb && dist(p[4], p[9]) / size > 0.65) {
      const direction = cameraPoints.length === 21 ? cameraPoints : p;
      const dx = direction[4].x - direction[2].x,
        dy = direction[4].y - direction[2].y;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) id = dy < 0 ? "up" : "down";
    } else if (!thumb) id = "fist";
  } else if (i && m && !r && !l && dist(p[8], p[12]) / size > 0.22)
    id = "peace";
  else if (i && !m && !r && !l) id = "point";
  else if (i && !m && !r && l) id = "rock";
  else if (i && m && r && !l) id = "three";
  if (!id) return null;
  // Geometric quality, not a calibrated probability of accuracy.
  const straight = fingers.map((f, k) =>
    f === 1
      ? Math.min(
          angle(p[5 + k * 4], p[6 + k * 4], p[7 + k * 4]),
          angle(p[6 + k * 4], p[7 + k * 4], p[8 + k * 4]),
        ) / 180
      : 1,
  );
  return { id, score: Math.min(...straight) };
}

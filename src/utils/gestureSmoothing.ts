import type { Prediction } from "../types/gesture";
export class GestureSmoother {
  private frames: { p: Prediction | null; t: number }[] = [];
  private confirmed: { p: Prediction; t: number } | null = null;
  reset() {
    this.frames = [];
    this.confirmed = null;
  }
  update(p: Prediction | null, t: number): Prediction | null {
    this.frames.push({ p, t });
    // A time window with only three required observations can confirm at 3 FPS.
    // The old six-frame/650ms combination could never confirm below ~8 FPS.
    this.frames = this.frames.filter((f) => t - f.t <= 1000);
    if (p && this.frames.length >= 3 && t - this.frames[0].t >= 300) {
      const votes = this.frames.filter((f) => f.p?.id === p.id);
      const stability = votes.length / this.frames.length;
      if (votes.length >= 3 && stability >= 0.75) {
        const result = {
          id: p.id,
          score:
            (stability * votes.reduce((s, f) => s + f.p!.score, 0)) /
            votes.length,
        };
        this.confirmed = { p: result, t };
        return result;
      }
    }
    // Bridge a brief inference dropout, never an indefinitely stale label.
    // A different explicit candidate isn't displayed as the old gesture.
    if (
      this.confirmed &&
      (!p || p.id === this.confirmed.p.id) &&
      t - this.confirmed.t <= 250
    )
      return this.confirmed.p;
    return null;
  }
}

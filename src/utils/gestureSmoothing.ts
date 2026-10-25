import type { Prediction } from "../types/gesture";
export class GestureSmoother {
  private frames: { p: Prediction | null; t: number }[] = [];
  reset() {
    this.frames = [];
  }
  update(p: Prediction | null, t: number): Prediction | null {
    this.frames.push({ p, t });
    this.frames = this.frames.filter((f) => t - f.t <= 650);
    if (!p || this.frames.length < 6 || t - this.frames[0].t < 300) return null;
    const votes = this.frames.filter((f) => f.p?.id === p.id);
    const stability = votes.length / this.frames.length;
    if (stability < 0.8) return null;
    return {
      id: p.id,
      score:
        (stability * votes.reduce((s, f) => s + f.p!.score, 0)) / votes.length,
    };
  }
}

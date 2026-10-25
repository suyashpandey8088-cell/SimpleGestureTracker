import {
  Camera,
  ArrowUpRight,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { Recognition } from "../hooks/useGestureRecognition";
export function PermissionState({ r }: { r: Recognition }) {
  return (
    <div className="permission-state">
      <div className="camera-glyph">
        {r.status === "loading" ? (
          <LoaderCircle className="spin" size={34} />
        ) : r.status === "error" ? (
          <TriangleAlert size={32} />
        ) : (
          <Camera size={33} strokeWidth={1.3} />
        )}
      </div>
      <h3>
        {r.status === "loading"
          ? "Getting things ready…"
          : r.status === "error"
            ? "Let’s reconnect"
            : "A little wave goes a long way."}
      </h3>
      <p>
        {r.error ||
          (r.status === "loading"
            ? "Allow camera access, then we’ll load the hand-tracking model."
            : "Enable your camera and let your hands do the talking.\nVideo stays on your device. Translation shares landmarks only after a separate opt-in.")}
      </p>
      {r.status === "loading" ? (
        <button className="secondary" onClick={r.stop}>
          Cancel setup
        </button>
      ) : (
        <button className="primary" onClick={() => void r.start()}>
          <Camera size={16} />
          {r.status === "error" ? "Try again" : "Enable camera"}
          <ArrowUpRight size={16} />
        </button>
      )}
      <small>
        <ShieldCheck size={13} />
        No webcam video recorded or uploaded.
      </small>
    </div>
  );
}

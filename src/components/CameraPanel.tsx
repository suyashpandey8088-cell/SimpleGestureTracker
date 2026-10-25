import { Video, Maximize, Minimize, LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";
import type { Recognition } from "../hooks/useGestureRecognition";
import { CameraControls } from "./CameraControls";
import { PermissionState } from "./PermissionState";
export function CameraPanel({ r }: { r: Recognition }) {
  const panel = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={"panel camera-panel " + (expanded ? "expanded" : "")}
      ref={panel}
    >
      <div className="panel-top">
        <h3>
          <Video size={16} />
          Live camera <span className="panel-label">INPUT 01</span>
        </h3>
        <button
          className="icon-button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Exit expanded camera" : "Expand camera"}
        >
          {expanded ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
      </div>
      <div className="camera-stage">
        <div
          className="video-wrap"
          style={{ transform: r.mirror ? "scaleX(-1)" : undefined }}
        >
          <video ref={r.video} playsInline muted />
          <canvas ref={r.canvas} />
        </div>
        <div className="feed-badges">
          <span>
            <i className={"dot " + (r.status === "active" ? "green" : "")} />
            {r.status === "active"
              ? r.paused
                ? "PAUSED"
                : "LIVE FEED"
              : "CAMERA OFFLINE"}
          </span>
          <span>{r.status === "active" ? `${r.fps} FPS` : "— FPS"}</span>
        </div>
        {r.status !== "active" && <PermissionState r={r} />}
        <div className="view-corner tl" />
        <div className="view-corner tr" />
        <div className="view-corner bl" />
        <div className="view-corner br" />
        {r.status === "active" && (
          <span className="tracking-notice">
            {r.paused ? "Detection paused" : r.notice}
          </span>
        )}
        <div className="camera-bottom">
          <span>
            <LockKeyhole size={11} />
            LOCAL PROCESSING
          </span>
          <span>MEDIAPIPE VISION</span>
        </div>
      </div>
      <CameraControls r={r} />
    </div>
  );
}

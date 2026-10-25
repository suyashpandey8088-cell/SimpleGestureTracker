import {
  CameraOff,
  Pause,
  Play,
  FlipHorizontal,
  Scan,
  Volume2,
  VolumeX,
  SwitchCamera,
} from "lucide-react";
import type { Recognition } from "../hooks/useGestureRecognition";
export function CameraControls({ r }: { r: Recognition }) {
  const active = r.status === "active";
  return (
    <div className="camera-controls">
      <div className="control-group">
        <button className="control" disabled={!active} onClick={r.togglePause}>
          {r.paused ? <Play size={15} /> : <Pause size={15} />}
          <span>{r.paused ? "Resume" : "Pause"}</span>
        </button>
        <button
          className="control"
          disabled={r.status === "idle" || r.status === "error"}
          onClick={r.stop}
        >
          <CameraOff size={15} />
          <span>Stop</span>
        </button>
      </div>
      <div className="control-group">
        <button
          className={"control " + (r.mirror ? "toggled" : "")}
          aria-pressed={r.mirror}
          aria-label="Mirror preview"
          title="Mirror preview"
          onClick={() => r.setMirror(!r.mirror)}
        >
          <FlipHorizontal size={16} />
          <span>Mirror</span>
        </button>
        <button
          className={"control " + (r.landmarks ? "toggled" : "")}
          aria-pressed={r.landmarks}
          aria-label="Show landmarks"
          title="Show landmarks"
          onClick={() => r.setLandmarks(!r.landmarks)}
        >
          <Scan size={16} />
          <span>Landmarks</span>
        </button>
        <button
          className={"control icon-control " + (r.sound ? "toggled" : "")}
          aria-label="Sound feedback"
          aria-pressed={r.sound}
          onClick={() => r.setSound(!r.sound)}
        >
          {r.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        {r.devices.length > 1 && (
          <label className="camera-select">
            <SwitchCamera size={16} />
            <select
              aria-label="Select camera"
              value={r.device}
              disabled={!active}
              onChange={(e) => void r.start(e.target.value)}
            >
              {r.devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

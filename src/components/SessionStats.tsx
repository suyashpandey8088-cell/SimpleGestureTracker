import { ScanLine, Fingerprint, TrendingUp, Clock3 } from "lucide-react";
import { byId } from "../utils/gestureDefinitions";
import type { Recognition } from "../hooks/useGestureRecognition";
export function SessionStats({ r }: { r: Recognition }) {
  const entries = Object.entries(r.counts),
    total = entries.reduce((s, [, n]) => s + n, 0),
    top = entries.sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="stats-grid">
      {[
        {
          icon: ScanLine,
          label: "Gestures recognized",
          value: total.toString().padStart(2, "0"),
          detail: "this session",
        },
        {
          icon: Fingerprint,
          label: "Unique gestures",
          value: entries.length.toString().padStart(2, "0"),
          detail: "/ 9 supported",
        },
        {
          icon: TrendingUp,
          label: "Top gesture",
          value: top ? byId[top[0]].name : "Not detected",
          detail: top ? `${top[1]} confirmations` : "make your first move",
        },
        {
          icon: Clock3,
          label: "Session duration",
          value: `${Math.floor(r.seconds / 60)
            .toString()
            .padStart(2, "0")}:${(r.seconds % 60).toString().padStart(2, "0")}`,
          detail: r.status === "active" ? "camera active" : "camera offline",
        },
      ].map(({ icon: Icon, label, value, detail }) => (
        <div className="stat-card" key={label}>
          <div className="stat-label">
            <Icon size={15} />
            {label}
          </div>
          <div className="stat-value">
            {value}
            <span>{detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

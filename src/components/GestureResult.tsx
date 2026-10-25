import { AnimatePresence, motion } from "motion/react";
import { ScanLine, ArrowUpRight, Activity } from "lucide-react";
import { byId } from "../utils/gestureDefinitions";
import type { Recognition } from "../hooks/useGestureRecognition";
export function GestureResult({
  r,
  target,
}: {
  r: Recognition;
  target: string | null;
}) {
  const g = r.prediction ? byId[r.prediction.id] : null;
  return (
    <aside className="panel result-panel">
      <div className="panel-top">
        <h3>
          <Activity size={16} />
          Recognition
        </h3>
        <span className="live-chip">{g ? "DETECTED" : "STANDBY"}</span>
      </div>
      <div className="result-body">
        <div className="eyebrow">CURRENT GESTURE</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={g?.id || "none"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="gesture-display"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={"gesture-orb " + (g ? "recognized" : "")}>
              {g ? (
                <span>{g.emoji}</span>
              ) : (
                <ScanLine size={42} strokeWidth={1} />
              )}
            </div>
            <h3>
              {g
                ? g.name
                : r.paused
                  ? "Detection paused"
                  : "Ready when you are"}
            </h3>
            <p>{g ? g.meaning : "Your next gesture starts here."}</p>
            {g && <div className="gesture-message">{g.message}</div>}
          </motion.div>
        </AnimatePresence>
        <div className="stability">
          <div>
            <span>Recognition stability</span>
            <strong>
              {r.prediction ? `${Math.round(r.prediction.score * 100)}%` : "—"}
            </strong>
          </div>
          <div className="progress-track">
            <div style={{ width: `${(r.prediction?.score || 0) * 100}%` }} />
          </div>
          <small>
            {g
              ? "Geometric quality × recent frame agreement"
              : "Waiting for a clear hand gesture"}
          </small>
        </div>
        <div className="result-meta">
          <span>Last detected</span>
          <span>
            {r.detectedAt
              ? new Date(r.detectedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "Not yet"}
          </span>
        </div>
      </div>
      <div className="result-tip">
        <span className="tip-icon">✦</span>
        <p>
          {target ? (
            <>
              Your challenge: <b>{byId[target].name}</b>
              <br />
              {byId[target].instruction}
            </>
          ) : (
            <>
              A tip for your first gesture
              <br />
              <b>Keep one hand visible in good lighting.</b>
            </>
          )}
        </p>
        <ArrowUpRight size={15} />
      </div>
    </aside>
  );
}

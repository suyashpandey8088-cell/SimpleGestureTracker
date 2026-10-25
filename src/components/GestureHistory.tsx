import { History, Trash2, CornerDownLeft } from "lucide-react";
import { byId } from "../utils/gestureDefinitions";
import type { Recognition } from "../hooks/useGestureRecognition";
export function GestureHistory({ r }: { r: Recognition }) {
  return (
    <section className="panel history-panel">
      <div className="panel-top">
        <h3>
          <History size={16} />
          Recent detections
          <span className="count-badge">{r.history.length}</span>
        </h3>
        <button
          className="text-button muted"
          disabled={!r.history.length}
          onClick={r.clearHistory}
        >
          <Trash2 size={13} />
          Clear history
        </button>
      </div>
      {r.history.length ? (
        <div className="history-list">
          {r.history.map((h, i) => (
            <div className="history-entry" key={`${h.time}-${i}`}>
              <span className="history-emoji">{byId[h.id].emoji}</span>
              <div>
                <b>{byId[h.id].name}</b>
                <small>{byId[h.id].meaning}</small>
              </div>
              <span className="history-score">
                {Math.round(h.score * 100)}% stability
              </span>
              <time>{new Date(h.time).toLocaleTimeString()}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="history-empty">
          <span>
            <CornerDownLeft size={19} />
          </span>
          <div>
            <b>A blank canvas for your conversations.</b>
            <p>Your last 10 recognized gestures will appear here.</p>
          </div>
          <span className="local-tag">SAVED LOCALLY</span>
        </div>
      )}
    </section>
  );
}

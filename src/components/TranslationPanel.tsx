import { Languages, Plug, Unplug, Check, Trash2 } from "lucide-react";
import type { Translation } from "../hooks/useTranslation";
export function TranslationPanel({
  t,
  cameraActive,
}: {
  t: Translation;
  cameraActive: boolean;
}) {
  const connected = t.state === "streaming" || t.state === "finishing",
    busy = t.state === "connecting" || t.state === "finishing";
  return (
    <section
      className="panel translation-panel"
      id="translation"
      aria-labelledby="translation-title"
    >
      <div className="panel-top">
        <h3 id="translation-title">
          <Languages size={17} />
          ISL sentence translation
          <span className="panel-label">RESEARCH PIPELINE</span>
        </h3>
        <span className="live-chip">
          {connected ? "SERVER CONNECTED" : "MODEL REQUIRED"}
        </span>
      </div>
      <div className="translation-layout">
        <div>
          <h3>Movement → meaning → text.</h3>
          <p className="translation-explainer">
            A trained temporal model translates two-hand and body landmark
            sequences. This is separate from the nine local gestures and
            alphabet fingerspelling. No trained translation weights are included
            yet.
          </p>
          <label className="translation-consent">
            <input
              type="checkbox"
              checked={t.consent}
              onChange={(e) => t.setConsent(e.target.checked)}
            />
            I agree to send hand/body landmark sequences to the configured
            inference server. No RGB frames or audio are sent.
          </label>
          <div className="translation-actions">
            {connected || t.state === "connecting" ? (
              <button className="secondary" onClick={t.disconnect}>
                <Unplug size={14} />
                Disconnect
              </button>
            ) : (
              <button
                className="primary"
                disabled={!t.consent || !cameraActive}
                onClick={() => void t.connect()}
              >
                <Plug size={14} />
                Connect translation
              </button>
            )}
            <button
              className="secondary"
              disabled={!connected || busy || t.frames < 3}
              onClick={t.finish}
            >
              <Check size={14} />
              Finish sentence
            </button>
          </div>
          {!cameraActive && (
            <small className="translation-hint">
              Start the camera above before connecting translation.
            </small>
          )}
          <p className="translation-status" role="status">
            {t.message}
          </p>
          <div className="translation-details">
            {t.frames} / 240 buffered frames · max 24 seconds
            {t.version ? ` · Model ${t.version}` : ""}
          </div>
        </div>
        <div className="transcript-area">
          <label htmlFor="interim-text">INTERIM · UNCONFIRMED</label>
          <div id="interim-text" className="interim-text" aria-live="polite">
            {t.interim || "No translation predicted."}
          </div>
          <div className="transcript-title">
            <label htmlFor="transcript-text">EDITABLE TRANSCRIPT</label>
            <button
              className="text-button muted"
              disabled={!t.transcript}
              onClick={() => t.setTranscript("")}
            >
              <Trash2 size={12} />
              Clear text
            </button>
          </div>
          <textarea
            id="transcript-text"
            value={t.transcript}
            onChange={(e) => t.setTranscript(e.target.value)}
            placeholder="Confirmed sentences appear here. You can correct them freely."
          />
          <small>
            Text stays in memory; it is not saved to local history. No
            auto-finalization when hands disappear.
          </small>
        </div>
      </div>
    </section>
  );
}

import { useState, useEffect, useRef } from "react";
import { Search, ArrowUpRight, X, Hand } from "lucide-react";
import { gestures } from "../utils/gestureDefinitions";
import type { GestureDefinition } from "../types/gesture";
export function GestureLibrary({
  onTry,
}: {
  onTry: (g: GestureDefinition) => void;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<GestureDefinition | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const matches = gestures.filter((g) =>
    `${g.name} ${g.meaning}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="library" id="library">
      <div className="section-heading library-heading">
        <div>
          <div className="eyebrow">A LITTLE MOVEMENT. A LOT OF MEANING.</div>
          <h2>
            The gesture vocabulary<span className="count-badge">09</span>
          </h2>
          <p>Nine ways to say it, without saying a word.</p>
        </div>
        <label className="search">
          <Search size={16} />
          <input
            ref={searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a gesture…"
            aria-label="Search gestures"
          />
          <kbd>/</kbd>
        </label>
      </div>
      <div className="gesture-grid">
        {matches.map((g, i) => (
          <article className="gesture-card" key={g.id}>
            <button
              className="gesture-card-main"
              onClick={() => setSelected(g)}
              aria-label={`Details for ${g.name}`}
            >
              <span className="gesture-number">0{gestures.indexOf(g) + 1}</span>
              <span className={"library-emoji emoji-" + i}>{g.emoji}</span>
              <h3>{g.name}</h3>
              <p>{g.meaning}</p>
              <span className="card-instruction">{g.instruction}</span>
            </button>
            <button className="try-button" onClick={() => onTry(g)}>
              Try this gesture
              <ArrowUpRight size={14} />
            </button>
          </article>
        ))}
      </div>
      {!matches.length && (
        <div className="empty-search">
          No gestures found. Try “peace” or “approval”.
        </div>
      )}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <dialog
            ref={dialog}
            onCancel={() => setSelected(null)}
            className="gesture-modal"
            aria-labelledby="gesture-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
            }}
          >
            <button
              autoFocus
              className="icon-button modal-close"
              aria-label="Close details"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <div className="modal-emoji">{selected.emoji}</div>
            <div className="eyebrow">GESTURE GUIDE</div>
            <h2 id="gesture-title">{selected.name}</h2>
            <p className="modal-meaning">{selected.meaning}</p>
            <p>{selected.instruction}</p>
            <small>
              Hold the pose for half a second. Keep your full hand visible and
              use even lighting. One hand at a time.
            </small>
            <button
              className="primary"
              onClick={() => {
                onTry(selected);
                setSelected(null);
              }}
            >
              <Hand size={16} />
              Try this gesture
              <ArrowUpRight size={16} />
            </button>
          </dialog>
        </div>
      )}
    </section>
  );
}

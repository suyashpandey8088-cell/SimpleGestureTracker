import { useState, useEffect } from "react";
import { MotionConfig } from "motion/react";
import {
  ArrowUpRight,
  ShieldCheck,
  Hand,
  ScanLine,
  Waypoints,
  MousePointer2,
} from "lucide-react";
import { useTranslation } from "./hooks/useTranslation";
import { TranslationPanel } from "./components/TranslationPanel";
import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { CameraPanel } from "./components/CameraPanel";
import { GestureResult } from "./components/GestureResult";
import { SessionStats } from "./components/SessionStats";
import { GestureHistory } from "./components/GestureHistory";
import { GestureLibrary } from "./components/GestureLibrary";
import { useGestureRecognition } from "./hooks/useGestureRecognition";
export default function App() {
  const translation = useTranslation();
  const r = useGestureRecognition(translation.onFrame);
  useEffect(() => {
    if (r.status !== "active" || r.paused) translation.disconnect();
  }, [r.status, r.paused, translation.disconnect]);
  const [target, setTarget] = useState<string | null>(null);
  const scroll = () =>
    document.getElementById("detection")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  return (
    <MotionConfig reducedMotion="user">
      <Navbar active={r.status === "active"} />
      <main>
        <HeroSection
          start={() => {
            scroll();
            if (r.status !== "active" && r.status !== "loading") void r.start();
          }}
        />
        <section id="detection" className="workspace">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR REAL-TIME PLAYGROUND</div>
              <h2>
                Make a move.
                <span className="heading-muted"> See it understood.</span>
              </h2>
            </div>
            <div className="workspace-status">
              <span
                className={"dot " + (r.status === "active" ? "green" : "")}
              />
              {r.status === "active" ? "Workspace live" : "Workspace ready"}
              <span className="divider" />
              Browser-based AI
            </div>
          </div>
          <div className="detection-grid">
            <CameraPanel r={r} />
            <GestureResult r={r} target={target} />
          </div>
          <SessionStats r={r} />
          <GestureHistory r={r} />
          <div className="privacy-strip">
            <ShieldCheck size={16} />
            <span>
              Local gesture mode: <b>camera frames stay on your device.</b>
            </span>
            <span className="privacy-detail">
              Translation shares landmarks only with explicit consent.
              <ArrowUpRight size={14} />
            </span>
          </div>
        </section>
        <TranslationPanel
          t={translation}
          cameraActive={r.status === "active" && !r.paused}
        />
        <GestureLibrary
          onTry={(g) => {
            setTarget(g.id);
            scroll();
          }}
        />
        <section className="about" id="about">
          <div>
            <div className="eyebrow">
              COMPLEX TECHNOLOGY. SIMPLE INTERACTION.
            </div>
            <h2>
              A little science.
              <br />
              <span className="heading-muted">A lot of possibility.</span>
            </h2>
            <p>
              Powered by MediaPipe, made for the moment.
              <br />
              On-device gestures. Optional server-based ISL research.
            </p>
          </div>
          <div className="steps">
            {[
              {
                icon: MousePointer2,
                title: "01 / Give it a little permission",
                text: "Enable your webcam. You’re in control of when it starts and stops.",
              },
              {
                icon: Waypoints,
                title: "02 / Let your hands speak",
                text: "21 landmarks map each hand. Local gesture recognition stays on your device.",
              },
              {
                icon: ScanLine,
                title: "03 / Meet instant understanding",
                text: "Geometry and stable-frame voting turn your pose into meaningful feedback.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div className="step" key={title}>
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <a className="brand" href="#home">
          <Hand size={20} />
          Gesture<span className="brand-ai">AI</span>
        </a>
        <span>Less typing. More expressing.</span>
        <span>
          Built for human connection. <span className="footer-star">✳</span>
        </span>
      </footer>
    </MotionConfig>
  );
}

import { ArrowDown, ArrowUpRight, ScanLine } from "lucide-react";
export function HeroSection({ start }: { start: () => void }) {
  return (
    <section className="hero" id="home">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="tiny-line" /> THE NEXT WAVE OF INTERACTION
        </div>
        <h1>
          Your hands.
          <br />
          <span>Your language.</span>
          <span className="heading-star">✳</span>
        </h1>
        <p>
          Turn simple hand gestures into instant, intelligent
          <br className="desktop-break" /> visual feedback. No words needed.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={start}>
            <ScanLine size={17} />
            Start detection
            <ArrowUpRight size={16} />
          </button>
          <a className="text-button" href="#library">
            Explore gestures <ArrowDown size={15} />
          </a>
        </div>
        <div className="hero-foot">
          <span>
            <i className="dot green" />
            Real-time recognition
          </span>
          <span>
            <i className="dot purple" />
            100% on-device
          </span>
          <span>
            <i className="dot blue" />9 gestures, endless possibilities
          </span>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="art-cross cross-one">+</div>
        <div className="art-cross cross-two">+</div>
        <span className="art-label top-label">
          HAND LANDMARK MODEL <span>v1.0</span>
        </span>
        <svg viewBox="0 0 400 330" className="hand-illustration">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <linearGradient id="hand-gradient" x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#a1ec7b" />
              <stop offset="1" stopColor="#b5a2ff" />
            </linearGradient>
          </defs>
          <path
            d="M148 294 C132 261 118 240 104 215 L66 163 Q58 148 71 141 Q81 138 91 151 L123 184 L109 80 Q108 63 120 62 Q132 62 135 78 L153 155 L150 44 Q151 28 164 30 Q175 31 176 48 L185 149 L194 47 Q196 32 207 34 Q219 36 218 53 L216 153 L233 81 Q238 66 250 71 Q261 75 257 91 L239 201 Q234 241 218 271 L213 294 Z"
            fill="url(#hand-gradient)"
            fillOpacity=".035"
            stroke="url(#hand-gradient)"
            strokeOpacity=".23"
            strokeWidth="1.5"
          />
          <g
            fill="none"
            stroke="url(#hand-gradient)"
            strokeWidth="1.3"
            opacity=".8"
          >
            <path d="M179 278 L139 211 L110 189 L89 163 L72 148 M179 278 L159 176 L147 132 L135 94 L121 68 M159 176 L190 170 L219 177 L235 196 L179 278 M190 170 L181 117 L169 75 L163 38 M219 177 L215 126 L209 80 L205 42 M235 196 L243 152 L247 113 L248 77 M139 211 L159 176" />
          </g>
          <g fill="#b9efa0" stroke="#101820" strokeWidth="2">
            {[
              [179, 278],
              [139, 211],
              [110, 189],
              [89, 163],
              [72, 148],
              [159, 176],
              [147, 132],
              [135, 94],
              [121, 68],
              [190, 170],
              [181, 117],
              [169, 75],
              [163, 38],
              [219, 177],
              [215, 126],
              [209, 80],
              [205, 42],
              [235, 196],
              [243, 152],
              [247, 113],
              [248, 77],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === 0 ? 5 : 3.5} />
            ))}
          </g>
          <g stroke="#9bea77" strokeOpacity=".5" fill="none">
            <path d="M49 93 V53 H89 M271 53 H301 V93 M49 249 V289 H89 M271 289 H301 V249" />
          </g>
        </svg>
        <span className="art-coordinates">
          21 LANDMARKS <span>•</span> INFINITE EXPRESSION
        </span>
        <span className="float-tag">
          <i className="dot green" />
          Built to understand you
        </span>
      </div>
    </section>
  );
}

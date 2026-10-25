import { Hand, ArrowUpRight } from "lucide-react";
export function Navbar({ active }: { active: boolean }) {
  return (
    <header className="navbar">
      <a className="brand" href="#home">
        <span className="brand-icon">
          <Hand size={23} />
        </span>
        Gesture<span className="brand-ai">AI</span>
        <span className="beta">BETA</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#home">Overview</a>
        <a className="nav-selected" href="#detection">
          Live detection
        </a>
        <a href="#library">Gesture library</a>
        <a href="#about">
          How it works <ArrowUpRight size={12} />
        </a>
      </nav>
      <div className="nav-status">
        <span className={"dot " + (active ? "green" : "")} />
        {active ? "Camera active" : "Camera offline"}
      </div>
    </header>
  );
}

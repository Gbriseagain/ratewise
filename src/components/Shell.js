import { useEffect, useState } from "react";
import { Icon, Logo } from "./ui";
import { link } from "../lib/router";

const THEME_KEY = "hindsight-theme";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [mode, setMode] = useState(readTheme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = mode === "system" ? (mq.matches ? "dark" : "light") : mode;
      document.documentElement.setAttribute("data-theme", resolved);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", resolved === "dark" ? "#0B1A2E" : "#F2F4F8");
    };
    apply();
    mq.addEventListener("change", apply);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // storage unavailable
    }
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  return [mode, setMode];
}

function ThemeToggle({ mode, setMode }) {
  const opts = [
    { v: "system", label: "Auto", title: "Match my device" },
    { v: "light", label: "☀", title: "Light" },
    { v: "dark", label: "☾", title: "Navy" },
  ];
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      {opts.map((o) => (
        <button key={o.v} type="button" title={o.title} aria-label={o.title} aria-pressed={mode === o.v}
          className={mode === o.v ? "on" : ""} onClick={() => setMode(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const LINKS = [
  { name: "home", label: "Home", icon: "home", href: "/" },
  { name: "search", label: "Search", icon: "search", href: "/search" },
  { name: "review", label: "Review", icon: "pen", href: "/review" },
  { name: "about", label: "About", icon: "info", href: "/about" },
];

export function TopBar({ route, theme, setTheme }) {
  return (
    <header className="topbar">
      <div className="wrap">
        <a className="brand" href={link("/")} aria-label="Hindsight home">
          <Logo />
          <span className="brand-name">Hindsight</span>
        </a>
        <nav className="toplinks" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.name} href={link(l.href)} className={`toplink${route.name === l.name ? " on" : ""}`}>
              {l.name === "review" ? "Leave a review" : l.label}
            </a>
          ))}
        </nav>
        <ThemeToggle mode={theme} setMode={setTheme} />
      </div>
    </header>
  );
}

export function TabBar({ route }) {
  return (
    <div className="tabbar">
      <nav aria-label="Main">
        {LINKS.map((l) => {
          const on = route.name === l.name;
          return (
            <a key={l.name} href={link(l.href)} className={`tab${on ? " on" : ""}${l.name === "review" ? " tab-review" : ""}`}
              aria-current={on ? "page" : undefined}>
              <span className="tab-icon"><Icon name={l.icon} size={22} /></span>
              <span>{l.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap spread">
        <span>Hindsight. Reviews from people who lived there.</span>
        <span className="row">
          <a href={link("/about")}>About</a>
          <a href={link("/terms")}>Terms</a>
          <a href={link("/privacy")}>Privacy and complaints</a>
          <a href={link("/contact")}>Contact</a>
        </span>
      </div>
      <div className="wrap tiny" style={{ marginTop: 10 }}>
        Postcode data from postcodes.io (Office for National Statistics, Ordnance Survey). Address suggestions and maps © OpenStreetMap contributors.
      </div>
    </footer>
  );
}

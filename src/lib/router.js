import { useEffect, useState } from "react";

// Router using normal page addresses (/search, /property/...), which Google
// can index. Netlify serves index.html for every address (see netlify.toml).

const NAV_EVENT = "hindsight:navigate";

function parse() {
  const path = window.location.pathname || "/";
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return {
    name: parts[0] || "home",
    id: parts[1] || null,
    query: new URLSearchParams(window.location.search),
    path: path + window.location.search,
  };
}

// Links shared before the change looked like /#/property/123.
function upgradeOldLink() {
  const h = window.location.hash;
  if (h.startsWith("#/")) window.history.replaceState(null, "", h.slice(1));
}

export function go(path, { replace = false } = {}) {
  const target = path.startsWith("/") ? path : `/${path}`;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (replace) window.history.replaceState(null, "", target);
  else if (target !== current) window.history.pushState(null, "", target);
  window.dispatchEvent(new Event(NAV_EVENT));
}

// Updates the address bar without changing page (for filters on a page).
export function setAddress(path) {
  window.history.replaceState(null, "", path);
}

export function link(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function useRoute() {
  const [route, setRoute] = useState(() => {
    upgradeOldLink();
    return parse();
  });

  useEffect(() => {
    const onPop = () => setRoute(parse());
    const onNav = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    // Same-site links change page instantly, without reloading the site.
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.getAttribute("href"), window.location.href);
      if (url.origin !== window.location.origin) return;
      if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
      e.preventDefault();
      go(url.pathname + url.search + url.hash);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener(NAV_EVENT, onNav);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener(NAV_EVENT, onNav);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return route;
}

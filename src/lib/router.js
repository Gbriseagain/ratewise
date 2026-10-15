import { useEffect, useState } from "react";

// Tiny hash router: #/path/segments?query=1
// Hash routes work on Netlify, GitHub Pages and inside an app wrapper
// without any server configuration.

function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { name: parts[0] || "home", id: parts[1] || null, query: new URLSearchParams(qs), path };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function go(path) {
  const target = path.startsWith("#") ? path : `#${path}`;
  if (window.location.hash === target) window.scrollTo(0, 0);
  else window.location.hash = target;
}

export function link(path) {
  return path.startsWith("#") ? path : `#${path}`;
}

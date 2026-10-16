import { useEffect } from "react";
import { SITE_URL } from "../config";

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith("link") ? "link" : "meta");
    const m = selector.match(/\[(\w+)="([^"]+)"\]/);
    if (m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

// Sets the page title, description and canonical address that search
// engines and link previews read.
export function useSeo({ title, description, path, noindex = false }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
    }
    if (title) setMeta('meta[property="og:title"]', "content", title);
    const canonical = `${SITE_URL}${path || window.location.pathname}`;
    setMeta('link[rel="canonical"]', "href", canonical);
    setMeta('meta[property="og:url"]', "content", canonical);
    setMeta('meta[name="robots"]', "content", noindex ? "noindex, nofollow" : "index, follow");
  }, [title, description, path, noindex]);
}

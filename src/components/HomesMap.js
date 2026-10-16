import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { go } from "../lib/router";
import { band, displayAddress, fmt, overall, propertyPath } from "../lib/stats";

// Map of reviewed homes. Loaded only when someone opens the map view.
// Tiles from OpenStreetMap (free, attribution required).

const UK = { lat: 54.4, lon: -2.6, zoom: 5 };

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Homes at the same postcode share a point, so group them into one marker.
function groupByPoint(properties) {
  const groups = new Map();
  properties.forEach((p) => {
    if (p.latitude == null || p.longitude == null) return;
    const k = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    if (!groups.has(k)) groups.set(k, { lat: p.latitude, lon: p.longitude, homes: [] });
    groups.get(k).homes.push(p);
  });
  return [...groups.values()];
}

export default function HomesMap({ properties, centre, label }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const here = useRef(null);

  // Create the map once.
  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true })
      .setView([UK.lat, UK.lon], UK.zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("popupopen", (e) => {
      e.popup.getElement().querySelectorAll("a[data-path]").forEach((a) => {
        a.addEventListener("click", (ev) => { ev.preventDefault(); go(a.dataset.path); });
      });
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  // Draw markers and frame the view whenever the homes or centre change.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current.clearLayers();
    const groups = groupByPoint(properties);

    groups.forEach((g) => {
      const score = g.homes.length === 1 ? overall(g.homes[0].reviews) : overall(g.homes.flatMap((h) => h.reviews));
      const count = g.homes.length > 1 ? `<span class="pin-count">${g.homes.length}</span>` : "";
      const icon = L.divIcon({
        className: "pin-wrap",
        html: `<span class="pin s${band(score)}">${fmt(score)}${count}</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -18],
      });
      const rows = g.homes.map((h) => {
        const n = h.reviews.length;
        return `<a href="${propertyPath(h)}" data-path="${propertyPath(h)}" class="pop-row">
          <strong>${escapeHtml(displayAddress(h))}</strong>
          <span>${escapeHtml(h.postcode)}, scored ${fmt(overall(h.reviews))} from ${n} ${n === 1 ? "review" : "reviews"}</span>
        </a>`;
      }).join("");
      L.marker([g.lat, g.lon], { icon, keyboard: true, title: g.homes.map(displayAddress).join(", ") })
        .bindPopup(`<div class="pop">${rows}</div>`, { maxWidth: 280 })
        .addTo(layer.current);
    });

    if (here.current) { here.current.remove(); here.current = null; }
    if (centre) {
      here.current = L.circleMarker([centre.lat, centre.lon], { radius: 8, weight: 3, color: "#e9a84c", fillColor: "#e9a84c", fillOpacity: 0.35 })
        .bindTooltip(label || "Search centre")
        .addTo(m);
      m.setView([centre.lat, centre.lon], centre.zoom || 14);
    } else if (groups.length) {
      const bounds = L.latLngBounds(groups.map((g) => [g.lat, g.lon]));
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      m.setView([UK.lat, UK.lon], UK.zoom);
    }
  }, [properties, centre, label]);

  return <div ref={el} className="map" role="region" aria-label="Map of reviewed homes" />;
}

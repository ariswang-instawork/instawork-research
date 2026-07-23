import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { useGetSites } from "@/lib/api-client";
import type { Site } from "@/lib/api-client";
import { useSiteStorage } from "@/hooks/use-site";

// Fix Leaflet's default marker icon paths under Vite bundling (needed if any
// default-icon marker is ever rendered; our pins use DivIcons below).
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const PRIMARY = "hsl(221 83% 53%)";

type SiteWithCoords = Site & { latitude: number; longitude: number };

/** Escape API-sourced text before interpolating into DivIcon HTML. */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openingsText(n: number) {
  return `${n} ${n === 1 ? "opening" : "openings"}`;
}

type LabelPos = "left" | "right" | "above" | "below";

/** Per-site pill placement so the tight northeast cluster stays readable. */
const LABEL_POS: Record<string, LabelPos> = {
  "boston-ma": "above",
  "new-york-ny": "left",
  "philadelphia-pa": "below",
};

/** Compact pin: blue dot + white pill showing ONLY the open count. */
function badgeIcon(site: SiteWithCoords) {
  const isOpen = site.openCount > 0;
  const dotColor = isOpen ? PRIMARY : "#C7CAD6";
  const numColor = isOpen ? "#111827" : "#9CA3AF";
  const count = escapeHtml(String(site.openCount));
  const pos: LabelPos = LABEL_POS[site.key] ?? "right";
  const dot = `<span style="width:12px;height:12px;border-radius:9999px;background:${dotColor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);flex:none;"></span>`;
  const badge = `<span style="background:#fff;border-radius:9999px;padding:4px 12px;font-size:15px;line-height:1;font-weight:700;color:${numColor};box-shadow:0 1px 2px rgba(0,0,0,.15);display:inline-flex;align-items:center;justify-content:center;">${count}</span>`;
  const pillWidth = 24 + count.length * 9;

  if (pos === "above" || pos === "below") {
    const width = Math.max(pillWidth, 12);
    const height = 23 + 4 + 12;
    const column =
      pos === "above"
        ? `${badge}<span style="height:4px"></span>${dot}`
        : `${dot}<span style="height:4px"></span>${badge}`;
    return L.divIcon({
      className: "",
      html: `<div style="display:flex;flex-direction:column;align-items:center;white-space:nowrap;width:${width}px;">${column}</div>`,
      iconSize: [width, height],
      iconAnchor: [width / 2, pos === "above" ? height - 6 : 6],
    });
  }

  const width = 12 + 4 + pillWidth;
  const height = 23;
  return L.divIcon({
    className: "", // no default styles
    html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;width:${width}px;${
      pos === "left" ? "justify-content:flex-end;" : ""
    }">${pos === "left" ? badge + dot : dot + badge}</div>`,
    iconSize: [width, height],
    // Anchor on the dot so the pin sits exactly on the site coordinates.
    iconAnchor: pos === "left" ? [width - 6, height / 2] : [6, height / 2],
  });
}

/** Fit all pins on first load and fix Leaflet's hidden-container sizing bug. */
function FitAndSize({ sites }: { sites: SiteWithCoords[] }) {
  const map = useMap();

  useEffect(() => {
    // invalidateSize BEFORE fitting — otherwise Leaflet computes bounds
    // against a stale (often 0-width) container and pins land off-screen.
    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
      if (sites.length === 0) return;
      if (sites.length === 1) {
        map.setView([sites[0].latitude, sites[0].longitude], 10);
        return;
      }
      map.fitBounds(
        L.latLngBounds(sites.map((s) => [s.latitude, s.longitude] as [number, number])),
        // Labels extend inward (west pins label right, east pins label left),
        // so only modest padding is needed.
        { padding: [30, 30] },
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [map, sites]);

  return null;
}

/**
 * Interactive Leaflet + OpenStreetMap card showing one blue pin per research
 * site (live open counts from /api/sites — same source as the sessions list).
 * Tapping a pin opens a popup with a "View sessions" action that selects the
 * site and navigates to the filtered sessions list.
 */
export function SiteLeafletMap() {
  const { data, isLoading } = useGetSites();
  const { setSite } = useSiteStorage();
  const [, navigate] = useLocation();

  const sites = useMemo(
    () =>
      (data?.sites ?? []).filter(
        (s): s is SiteWithCoords =>
          typeof s.latitude === "number" && typeof s.longitude === "number",
      ),
    [data],
  );

  const handleView = (site: Site) => {
    setSite(site.key, site.label);
    // Session list lives inline on the landing page now.
    localStorage.setItem("iw_sessions_expanded", "1");
    navigate("/");
    window.dispatchEvent(new CustomEvent("iw:view-sessions"));
  };

  return (
    // `relative z-0` creates an isolated stacking context so Leaflet's
    // high-z-index panes (400+) can never bleed over the fixed footer CTA.
    <div className="relative z-0 rounded-xl border border-gray-200 bg-white overflow-hidden" data-testid="card-site-map">
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-3">
        <MapPin className="w-5 h-5 text-gray-500 shrink-0" strokeWidth={1.75} />
        <p className="text-[15px] font-medium leading-[1.4] text-gray-500">Tap a location to view open sessions.</p>
      </div>
      <div className="h-[280px] w-full relative">
        {isLoading || sites.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-500">
            Loading locations…
          </div>
        ) : (
          <MapContainer
            style={{ height: "100%", width: "100%" }}
            center={[39.5, -98.35]}
            zoom={4}
            zoomSnap={0.25}
            zoomDelta={0.5}
            scrollWheelZoom={false}
            attributionControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitAndSize sites={sites} />
            {sites.map((site) => (
              <Marker
                key={site.key}
                position={[site.latitude, site.longitude]}
                icon={badgeIcon(site)}
              >
                <Popup>
                  <div style={{ minWidth: 116 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2, marginBottom: 6 }}>{site.city}</div>
                    <div style={{ color: "#4B5563", fontSize: 15, fontWeight: 500, lineHeight: 1.3, marginBottom: 16 }}>
                      {openingsText(site.openCount)}
                    </div>
                    <button
                      onClick={() => handleView(site)}
                      style={{
                        background: PRIMARY,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 12px",
                        minHeight: 44,
                        width: "100%",
                        fontWeight: 600,
                        fontSize: 15,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                      data-testid={`button-view-sessions-${site.key}`}
                    >
                      View openings
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}

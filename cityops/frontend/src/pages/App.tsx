import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import maplibregl, { GeoJSONSource } from "maplibre-gl";

type KpiResponse = {
  eta_ems: number;
  travel_time_delta: number;
  queue_len_estimate: number;
};

const MAP_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const MAP_CENTER: [number, number] = [8.404, 49.006];
const MAP_ZOOM = 14;

const SEGMENT_SOURCE_ID = "segments";
const KPI_POLL_INTERVAL = 2000;

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  padding: "1.5rem",
  borderRadius: "1rem",
  background: "#ffffff",
  boxShadow: "0 10px 30px -15px rgba(15, 23, 42, 0.3)"
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#0f172a"
};

const buttonStyle: CSSProperties = {
  padding: "0.85rem 1.2rem",
  border: "none",
  borderRadius: "0.75rem",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
  background: "#2563eb",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.6rem",
  boxShadow: "0 8px 20px -12px rgba(37, 99, 235, 0.8)"
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem"
};

const kpiCardStyle: CSSProperties = {
  background: "#f8fafc",
  borderRadius: "0.9rem",
  padding: "1.1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  border: "1px solid rgba(15, 23, 42, 0.06)"
};

const mapWrapperStyle: CSSProperties = {
  position: "relative",
  borderRadius: "1rem",
  overflow: "hidden",
  minHeight: "400px",
  boxShadow: "0 15px 35px -20px rgba(15, 23, 42, 0.45)"
};

const mapContainerStyle: CSSProperties = {
  width: "100%",
  height: "100%"
};

const mapOverlayStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  right: "1rem",
  padding: "0.65rem 0.9rem",
  borderRadius: "0.75rem",
  backdropFilter: "blur(6px)",
  background: "rgba(30, 41, 59, 0.35)",
  color: "#f8fafc",
  fontSize: "0.9rem",
  fontWeight: 500,
  letterSpacing: "0.02em"
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

function formatMinutes(seconds: number): string {
  return (seconds / 60).toFixed(1);
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE");
}

export default function App(): JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [kpis, setKpis] = useState<KpiResponse>({
    eta_ems: 340,
    travel_time_delta: 0,
    queue_len_estimate: 120
  });

  const eventActive = kpis.travel_time_delta > 0;

  const refreshSegments = useCallback(async () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    try {
      const segments = await fetchJson<GeoJSON.FeatureCollection>("/api/map/segments");
      const existingSource = map.getSource(SEGMENT_SOURCE_ID) as GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(segments);
        return;
      }

      map.addSource(SEGMENT_SOURCE_ID, {
        type: "geojson",
        data: segments
      });

      map.addLayer({
        id: "segments-line",
        type: "line",
        source: SEGMENT_SOURCE_ID,
        paint: {
          "line-color": [
            "interpolate",
            ["linear"],
            ["get", "congestion"],
            0,
            "#00b341",
            0.5,
            "#ffd000",
            1,
            "#d02b2b"
          ],
          "line-width": 6,
          "line-cap": "round",
          "line-join": "round"
        }
      });
    } catch (error) {
      console.error("Failed to load corridor segments", error);
    }
  }, []);

  const fetchKpis = useCallback(async () => {
    try {
      const data = await fetchJson<KpiResponse>("/api/kpi");
      setKpis(data);
    } catch (error) {
      console.error("Failed to fetch KPIs", error);
    }
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: MAP_CENTER,
      zoom: MAP_ZOOM
    });

    mapRef.current = map;

    const handleLoad = () => {
      refreshSegments();
    };

    map.on("load", handleLoad);

    return () => {
      map.off("load", handleLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [refreshSegments]);

  useEffect(() => {
    fetchKpis();
    const intervalId = window.setInterval(fetchKpis, KPI_POLL_INTERVAL);
    return () => window.clearInterval(intervalId);
  }, [fetchKpis]);

  const handleToggleEvent = useCallback(async () => {
    const payload = eventActive
      ? { type: "clear", severity: 1 }
      : { type: "accident", severity: 3, nodeId: "seg_2" };

    try {
      await fetchJson("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await Promise.all([fetchKpis(), refreshSegments()]);
    } catch (error) {
      console.error("Failed to toggle event", error);
    }
  }, [eventActive, fetchKpis, refreshSegments]);

  const etaMinutes = useMemo(() => formatMinutes(kpis.eta_ems), [kpis.eta_ems]);
  const travelDeltaSeconds = useMemo(
    () => formatNumber(kpis.travel_time_delta),
    [kpis.travel_time_delta]
  );
  const queueEstimate = useMemo(
    () => formatNumber(kpis.queue_len_estimate),
    [kpis.queue_len_estimate]
  );

  return (
    <>
      <section style={panelStyle}>
        <header>
          <h1 style={headlineStyle}>CityOps Control</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>
            Live-Einblick in den Musterkorridor von Karlsruhe inklusive KPI-Trends
            und einer Was-w?re-wenn-Simulation.
          </p>
        </header>
        <button type="button" style={buttonStyle} onClick={handleToggleEvent}>
          {eventActive ? "Szenario zur?cksetzen" : "Was-w?re-wenn: Unfall @ Knoten X"}
        </button>
        <div style={kpiGridStyle}>
          <article style={kpiCardStyle}>
            <span style={{ color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ETA Rettung
            </span>
            <strong style={{ fontSize: "1.8rem", color: "#0f172a" }}>
              {etaMinutes} min
            </strong>
            <small style={{ color: "#94a3b8" }}>Bezugsgr??e: Baseline 340 s</small>
          </article>
          <article style={kpiCardStyle}>
            <span style={{ color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ? Reisezeit
            </span>
            <strong style={{ fontSize: "1.8rem", color: "#0f172a" }}>
              {travelDeltaSeconds} s
            </strong>
            <small style={{ color: "#94a3b8" }}>Zus?tzliche Verz?gerung</small>
          </article>
          <article style={kpiCardStyle}>
            <span style={{ color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Stauwelle
            </span>
            <strong style={{ fontSize: "1.8rem", color: "#0f172a" }}>
              {queueEstimate} m
            </strong>
            <small style={{ color: "#94a3b8" }}>Sch?tzung der Staul?nge</small>
          </article>
        </div>
      </section>
      <section style={mapWrapperStyle}>
        <div ref={mapContainerRef} style={mapContainerStyle} />
        <div style={mapOverlayStyle}>GeoJSON-Korridor &bull; MapLibre</div>
      </section>
    </>
  );
}

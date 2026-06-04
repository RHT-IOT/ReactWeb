"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";

type HeatPoint = {
  lng: number;
  lat: number;
  count: number;
};

declare global {
  interface Window {
    BMap?: any;
    BMapLib?: any;
    L?: any;
  }
}

const BAIDU_AK = process.env.NEXT_PUBLIC_BAIDU_MAP_AK ?? "";
const TIANDITU_KEY = process.env.NEXT_PUBLIC_TIANDITU_KEY ?? "";
const HEATMAP_API_ENDPOINT = "";

async function loadScript(src: string, forceSync = false): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src=\"${src}\"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = !forceSync;
    script.defer = false;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadBaiduCoreScript(ak: string): Promise<void> {
  if (window.BMap) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const callbackName = "__onBaiduMapReady";
    const src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}&callback=${callbackName}`;
    const existing = document.querySelector(`script[src=\"${src}\"]`) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Baidu Map SDK")), {
        once: true,
      });
      return;
    }

    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.defer = false;
    script.onerror = () => {
      delete (window as any)[callbackName];
      reject(new Error("Failed to load Baidu Map SDK"));
    };
    document.head.appendChild(script);
  });
}

async function ensureBaiduMapLoaded(ak: string): Promise<void> {
  if (!ak) {
    throw new Error("Missing NEXT_PUBLIC_BAIDU_MAP_AK");
  }

  await loadBaiduCoreScript(ak);
  await loadScript("https://api.map.baidu.com/library/Heatmap/2.0/src/Heatmap_min.js", true);
}

async function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function ensureTiandituLoaded(tk: string): Promise<void> {
  // Load Leaflet and the heat plugin; tiles use Tianditu WMTS when `tk` is provided
  if (window.L) return;
  await loadCss("https://unpkg.com/leaflet@1.9.3/dist/leaflet.css");
  await loadScript("https://unpkg.com/leaflet@1.9.3/dist/leaflet.js");
  await loadScript("https://unpkg.com/leaflet.heat/dist/leaflet-heat.js");
}

function getDemoHeatmapData(): HeatPoint[] {
  return [
    { lng: 116.418261, lat: 39.921984, count: 50 },
    { lng: 116.423332, lat: 39.916532, count: 51 },
    { lng: 116.419787, lat: 39.930658, count: 15 },
    { lng: 116.418455, lat: 39.920921, count: 40 },
    { lng: 116.418843, lat: 39.915516, count: 100 },
    { lng: 116.42546, lat: 39.918503, count: 6 },
    { lng: 116.423289, lat: 39.919989, count: 18 },
    { lng: 116.418162, lat: 39.915051, count: 80 },
    { lng: 116.422039, lat: 39.91782, count: 11 },
    { lng: 116.41387, lat: 39.917253, count: 7 },
    { lng: 116.41773, lat: 39.919426, count: 42 },
  ];
}

async function fetchHeatmapData(): Promise<HeatPoint[]> {
  // TODO: Replace this with your real endpoint when ready.
  if (!HEATMAP_API_ENDPOINT) {
    // default to generating around the provided center (Guangzhou coordinates)
    return generateRainfallHeatmap(113.50978, 22.73725, 80, 1, 3, 120);
  }

  const response = await fetch(HEATMAP_API_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch heatmap data: ${response.status}`);
  }

  const data = (await response.json()) as HeatPoint[];
  return data;
}

function generateRainfallHeatmap(
  centerLng: number,
  centerLat: number,
  num = 100,
  radiusKm = 1,
  clusters = 3,
  maxCount = 120
): HeatPoint[] {
  // Convert km offsets to degrees at the given latitude
  const latKmToDeg = 1 / 111.0; // ~111km per degree latitude
  const latDegPerKm = latKmToDeg;
  const lngDegPerKm = 1 / (111.320 * Math.cos((centerLat * Math.PI) / 180));

  // helper: sample a normal(0,1) via Box-Muller
  function normalStd(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // generate cluster centers uniformly within the radius
  const clusterCenters: { lng: number; lat: number; sigmaKm: number }[] = [];
  for (let c = 0; c < clusters; c++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radiusKm * Math.sqrt(Math.random());
    const clng = centerLng + Math.cos(angle) * r * lngDegPerKm;
    const clat = centerLat + Math.sin(angle) * r * latDegPerKm;
    // sigma controls cluster tightness (smaller = tighter)
    const sigmaKm = Math.max(0.05, radiusKm * (0.08 + Math.random() * 0.18));
    clusterCenters.push({ lng: clng, lat: clat, sigmaKm });
  }

  const points: HeatPoint[] = [];
  for (let i = 0; i < num; i++) {
    // choose a cluster with slight bias toward earlier ones
    const ci = Math.floor(Math.pow(Math.random(), 0.8) * clusters);
    const cluster = clusterCenters[Math.min(ci, clusters - 1)];

    // sample offset in km from cluster center using normal distribution
    const dxKm = normalStd() * cluster.sigmaKm;
    const dyKm = normalStd() * cluster.sigmaKm;

    const lng = cluster.lng + dxKm * lngDegPerKm;
    const lat = cluster.lat + dyKm * latDegPerKm;

    // distance from cluster center in km (approx)
    const distKm = Math.sqrt(dxKm * dxKm + dyKm * dyKm);

    // intensity decays with distance; add random multiplier for realism
    const intensityFactor = Math.exp(-(distKm * distKm) / (2 * cluster.sigmaKm * cluster.sigmaKm));
    const randMul = 0.6 + Math.random() * 1.2; // 0.6 - 1.8
    const raw = Math.max(1, Math.round(maxCount * intensityFactor * randMul));

    points.push({ lng, lat, count: raw });
  }

  return points;
}

/**
 * Convert an n x m numeric matrix into heatmap points.
 * - `matrix` is an array of rows, each row is an array of numbers (concentration).
 * - `topLeftLat/long` is the latitude/longitude of the matrix's top-left cell (center of that cell).
 * - `resolutionMeters` is the distance between adjacent matrix cells in meters.
 *
 * The function returns an array of `HeatPoint` suitable for a map heatmap overlay (lng, lat, count).
 */
function convertMatrixToHeatPoints(
  matrix: number[][],
  topLeftLat: number,
  topLeftLng: number,
  resolutionMeters: number,
  ignoreBelow = 0
): HeatPoint[] {
  const points: HeatPoint[] = [];
  if (!Array.isArray(matrix) || matrix.length === 0) return points;

  // Approx conversions (sufficient for <10km areas)
  const latDegPerMeter = 1 / 111000; // ~111 km per degree
  // Use top-left latitude for longitude scaling (small-area approximation)
  const topLeftLatRad = (topLeftLat * Math.PI) / 180;
  const lngDegPerMeter = 1 / (111320 * Math.cos(topLeftLatRad));

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const val = Number(row[c]) || 0;
      if (val <= ignoreBelow) continue;

      // row increases downward (south), column increases rightward (east)
      const lat = topLeftLat - r * resolutionMeters * latDegPerMeter;
      const lng = topLeftLng + c * resolutionMeters * lngDegPerMeter;

      points.push({ lng, lat, count: val });
    }
  }

  return points;
}

// Example usage (uncomment to test in dev):
// const exampleMatrix = [[10,20],[5,0]];
// const pts = convertMatrixToHeatPoints(exampleMatrix, 22.73925, 113.50978, 100);
// console.log('converted points', pts);

export default function TwoDPage() {
  const auth = useAuth();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const heatmapRef = useRef<any>(null);
  const randomTimerRef = useRef<number | null>(null);
  const [error, setError] = useState<string>("");
  const [topLeftLat, setTopLeftLat] = useState<number>(22.74225);
  const [topLeftLng, setTopLeftLng] = useState<number>(113.50478);
  const [resolutionMeters, setResolutionMeters] = useState<number>(100);
  const [ignoreBelow, setIgnoreBelow] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await ensureTiandituLoaded(TIANDITU_KEY);

        if (cancelled || !mapContainerRef.current || !window.L) return;

        const L = window.L;
        // Default display point around 22.73725 (lat) / 113.50978 (lng)
        const defaultLat = 22.73725;
        const defaultLng = 113.50978;

        const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 14);
        map.scrollWheelZoom.enable();

        const tileUrl = TIANDITU_KEY
          ? `https://t{s}.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&layer=vec&style=default&tilematrixset=w&TileMatrix={z}&TileRow={y}&TileCol={x}&tk=${encodeURIComponent(
              TIANDITU_KEY
            )}`
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

        const tileOptions: any = TIANDITU_KEY
          ? { subdomains: "01234567", attribution: "Tianditu" }
          : { subdomains: "abc", attribution: "© OpenStreetMap contributors" };

        L.tileLayer(tileUrl, tileOptions).addTo(map);

        // initial dataset (from API or generated near default)
        const initialPoints = await fetchHeatmapData();
        const initialLatLngs = initialPoints.map(p => [p.lat, p.lng, p.count]);
        const maxInitial = Math.max(1, ...initialPoints.map(p => p.count));

        const heat = L.heatLayer(initialLatLngs, { radius: 20, blur: 15, maxZoom: 17 }).addTo(map);
        heatmapRef.current = { layer: heat, map };

        // start random updates to demonstrate dynamic heatmap
        randomTimerRef.current = window.setInterval(() => {
          try {
            const pts = generateRainfallHeatmap(defaultLng, defaultLat, 60, 1, 3, 140);
            const latlngs = pts.map(p => [p.lat, p.lng, p.count]);
            (heatmapRef.current?.layer as any)?.setLatLngs(latlngs);
          } catch (e) {
            // ignore
          }
        }, 2000) as unknown as number;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize map";
        setError(message);
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (randomTimerRef.current) {
        window.clearInterval(randomTimerRef.current as unknown as number);
        randomTimerRef.current = null;
      }
      // remove map and layers if present
      try {
        if (heatmapRef.current?.map) {
          heatmapRef.current.map.remove();
        }
      } catch {}
    };
  }, []);

  // helper to silently refresh token if available
  async function getIdTokenAsync(): Promise<string> {
    try {
      const fn: any = (auth as any)?.signinSilent;
      if (typeof fn === "function") {
        const user = await fn();
        const tk = (user as any)?.id_token;
        if (tk) return tk;
      }
    } catch {}
    return auth?.user?.id_token || "";
  }

  async function fetchOdorMapAndRender() {
    if (!heatmapRef.current) return;
    const url = "https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/odor_map";
    const make = async (tk: string) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({}) });

    try {
      const idToken = auth?.user?.id_token || "";
      let res = await make(idToken);
      if ((res.status === 401 || res.status === 403) && typeof getIdTokenAsync === "function") {
        const newTk = await getIdTokenAsync();
        if (newTk) res = await make(newTk);
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed ${res.status} ${txt}`);
      }
      const json = await res.json();
      // backend returns { body: "{...}" }
      let bodyObj: any = json;
      if (json && typeof json.body === "string") {
        try {
          bodyObj = JSON.parse(json.body);
        } catch {
          bodyObj = json.body;
        }
      }
      const matrix = Array.isArray(bodyObj?.rainfall_matrix) ? bodyObj.rainfall_matrix : [];
      if (!matrix || matrix.length === 0) {
        throw new Error("No rainfall_matrix found in response");
      }

      // convert and render
      const points = convertMatrixToHeatPoints(matrix as number[][], Number(topLeftLat), Number(topLeftLng), Number(resolutionMeters), Number(ignoreBelow));
      // compute a sensible max from matrix values
      let maxVal = 0;
      for (const row of matrix) {
        for (const v of row) if (typeof v === "number" && v > maxVal) maxVal = v;
      }
      if (randomTimerRef.current) {
        window.clearInterval(randomTimerRef.current as unknown as number);
        randomTimerRef.current = null;
      }
      const latlngs = points.map(p => [p.lat, p.lng, p.count]);
      try {
        (heatmapRef.current?.layer as any)?.setLatLngs(latlngs);
      } catch {}
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <main style={{ padding: "16px" }}>
      <h1 style={{ margin: "0 0 12px" }}>2D Tianditu Heatmap Demo</h1>
      <p style={{ margin: "0 0 12px", color: "#666" }}>
        Set NEXT_PUBLIC_TIANDITU_KEY in your environment to use Tianditu tiles (or leave empty to use OpenStreetMap). The page will render a map with a heatmap overlay.
      </p>
      <div style={{ margin: "0 0 12px", display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 13 }}>
          Top-left Lat:
          <input style={{ marginLeft: 6, width: 120 }} value={topLeftLat} onChange={e => setTopLeftLat(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 13 }}>
          Top-left Lng:
          <input style={{ marginLeft: 6, width: 120 }} value={topLeftLng} onChange={e => setTopLeftLng(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 13 }}>
          Resolution (m):
          <input style={{ marginLeft: 6, width: 80 }} value={resolutionMeters} onChange={e => setResolutionMeters(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 13 }}>
          Ignore ≤
          <input style={{ marginLeft: 6, width: 60 }} value={ignoreBelow} onChange={e => setIgnoreBelow(Number(e.target.value))} />
        </label>
        <button className="brand-button" style={{ marginLeft: 8 }} onClick={() => void fetchOdorMapAndRender()}>
          Fetch & Render Odor Map
        </button>
      </div>
      {error ? (
        <p style={{ color: "crimson", marginBottom: "12px" }}>{error}</p>
      ) : null}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "70vh",
          minHeight: "420px",
          borderRadius: "8px",
          border: "1px solid #ddd",
          overflow: "hidden",
        }}
      />
    </main>
  );
}

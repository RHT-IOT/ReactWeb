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
  }
}

const BAIDU_AK = process.env.NEXT_PUBLIC_BAIDU_MAP_AK ?? "";
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
 * The function returns an array of `HeatPoint` suitable for the Baidu heatmap (lng, lat, count).
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
  const mapRef = useRef<any>(null);
  const heatmapRef = useRef<any>(null);
  const randomTimerRef = useRef<number | null>(null);
  const [error, setError] = useState<string>("");
  const [topLeftLat, setTopLeftLat] = useState<number>(22.74225);
  const [topLeftLng, setTopLeftLng] = useState<number>(113.50478);
  const [resolutionMeters, setResolutionMeters] = useState<number>(30);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await ensureBaiduMapLoaded(BAIDU_AK);

        if (cancelled || !mapContainerRef.current || !window.BMap || !window.BMapLib) {
          return;
        }
        const map = new window.BMap.Map(mapContainerRef.current);
        // Default display point around 22.73725 (lat) / 113.50978 (lng)
        const defaultLat = 22.73725;
        const defaultLng = 113.50978;
        const center = new window.BMap.Point(defaultLng, defaultLat);
        mapRef.current = map;
        map.centerAndZoom(center, 14);
        map.enableScrollWheelZoom(true);

        // create heatmap overlay and store for later updates
        const heatmapOverlay = new window.BMapLib.HeatmapOverlay({ radius: 20 });
        map.addOverlay(heatmapOverlay);
        heatmapRef.current = heatmapOverlay;

        // initial dataset (from API or generated near default)
        const initialPoints = await fetchHeatmapData();
        heatmapOverlay.setDataSet({ data: initialPoints, max: 100 });
        heatmapOverlay.show();

        // start random updates to demonstrate dynamic heatmap
        // updates will generate new points around the default center
        randomTimerRef.current = window.setInterval(() => {
          try {
            const pts = generateRainfallHeatmap(defaultLng, defaultLat, 60, 1, 3, 140);
            heatmapRef.current?.setDataSet({ data: pts, max: 120 });
          } catch (e) {
            // ignore individual update failures
          }
        }, 2000) as unknown as number;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize Baidu map";
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
      // hide heatmap if present
      try {
        if (heatmapRef.current && heatmapRef.current.hide) heatmapRef.current.hide();
      } catch {}
    };
  }, []);

  async function loadOdorMapFromApi() {
    if (!heatmapRef.current || !mapRef.current) return;
    setLoadingMatrix(true);
    try {
      const token = auth?.user?.access_token ?? auth?.user?.id_token ?? "";
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/odor_map", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      const body = JSON.parse(json?.body ?? "{}");
      const rows = Number(body.rows || body.n || 0);
      const cols = Number(body.cols || body.m || 0);
      const matrix = Array.isArray(body.rainfall_matrix) ? (body.rainfall_matrix as number[][]) : [];

      const points = convertMatrixToHeatPoints(matrix, topLeftLat, topLeftLng, resolutionMeters, 0);
      heatmapRef.current.setDataSet({ data: points, max: Math.max(...points.map((p: any) => p.count), 100) });

      if (rows > 0 && cols > 0) {
        const latDegPerMeter = 1 / 111000;
        const topLeftLatRad = (topLeftLat * Math.PI) / 180;
        const lngDegPerMeter = 1 / (111320 * Math.cos(topLeftLatRad));

        const centerLat = topLeftLat - ((rows - 1) / 2) * resolutionMeters * latDegPerMeter;
        const centerLng = topLeftLng + ((cols - 1) / 2) * resolutionMeters * lngDegPerMeter;
        try {
          mapRef.current.centerAndZoom(new window.BMap.Point(centerLng, centerLat), 14);
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingMatrix(false);
    }
  }

  return (
    <main style={{ padding: "16px" }}>
      <h1 style={{ margin: "0 0 12px" }}>2D Baidu Heatmap Demo</h1>
      <p style={{ margin: "0 0 12px", color: "#666" }}>
        Set NEXT_PUBLIC_BAIDU_MAP_AK in your environment, then this page will render a Baidu map with
        heatmap overlay.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label style={{ fontSize: 12, color: "#333" }}>
          Top-left Lat:
          <input
            type="number"
            step="0.000001"
            value={topLeftLat}
            onChange={(e) => setTopLeftLat(Number(e.target.value))}
            style={{ marginLeft: 6, width: 120 }}
          />
        </label>
        <label style={{ fontSize: 12, color: "#333" }}>
          Top-left Lng:
          <input
            type="number"
            step="0.000001"
            value={topLeftLng}
            onChange={(e) => setTopLeftLng(Number(e.target.value))}
            style={{ marginLeft: 6, width: 120 }}
          />
        </label>
        <label style={{ fontSize: 12, color: "#333" }}>
          Resolution (m):
          <input
            type="number"
            step="1"
            value={resolutionMeters}
            onChange={(e) => setResolutionMeters(Number(e.target.value))}
            style={{ marginLeft: 6, width: 80 }}
          />
        </label>
        <button onClick={() => void loadOdorMapFromApi()} disabled={loadingMatrix} style={{ padding: "6px 10px" }}>
          {loadingMatrix ? "Loading..." : "Fetch & Render"}
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

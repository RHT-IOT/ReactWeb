"use client";

import { useEffect, useRef, useState } from "react";

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

export default function TwoDPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const heatmapRef = useRef<any>(null);
  const randomTimerRef = useRef<number | null>(null);
  const [error, setError] = useState<string>("");

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

  return (
    <main style={{ padding: "16px" }}>
      <h1 style={{ margin: "0 0 12px" }}>2D Baidu Heatmap Demo</h1>
      <p style={{ margin: "0 0 12px", color: "#666" }}>
        Set NEXT_PUBLIC_BAIDU_MAP_AK in your environment, then this page will render a Baidu map with
        heatmap overlay.
      </p>
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

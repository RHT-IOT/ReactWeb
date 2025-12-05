"use client";
import React, { useMemo, useEffect, useState, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type HistoryEntry = { timestamps: string[]; seriesMap: Record<string, number[]> };
type HistoryStore = Record<string, HistoryEntry>;

type LatestLineChartProps = {
  deviceMap: Record<string, any> | undefined;
  deviceType?: string;
  dataType?: string[];
  maxPoints?: number; // default 10
  title?: string;
  height?: number; // per-chart height, default 180
  historyRef?: React.MutableRefObject<HistoryStore>;
  version?: number; // bump to re-read history on external updates
};

export default function LatestLineChart({ deviceMap, deviceType, dataType, maxPoints = 10, title = "Realtime Line Chart", height = 180, historyRef, version = 0 }: LatestLineChartProps) {
  const entry = useMemo(() => {
    if (!deviceMap || !deviceType) return undefined;
    return deviceMap[deviceType];
  }, [deviceMap, deviceType]);

  const numericFields = useMemo(() => {
    if (!entry) return [] as string[];
    const meta = new Set(["Timestamp", "DeviceID", "DeviceType"]);
    const keys = Object.keys(entry).filter(k => !meta.has(k) && typeof entry[k] === 'number');
    return dataType && dataType.length > 0 ? keys.filter(k => dataType.includes(k)) : keys;
  }, [entry, dataType]);

  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [seriesMap, setSeriesMap] = useState<Record<string, number[]>>({});
  const dataTypeKey = useMemo(() => JSON.stringify([...(dataType ?? [])].sort()), [dataType]);

  // Initialize and keep local render state in sync with shared history
  useEffect(() => {
    if (!deviceType) return;
    const store = historyRef?.current;
    const hist = store?.[deviceType];
    if (hist) {
      setTimestamps([...hist.timestamps]);
      setSeriesMap({ ...hist.seriesMap });
    }
  }, [deviceType, historyRef, version]);

  // Chart history is appended externally; keep only local view state here.

  // When maxPoints changes, just re-sync from store (store already trimmed externally)
  useEffect(() => {
    if (!deviceType) return;
    const store = historyRef?.current;
    const hist = store?.[deviceType];
    if (hist) {
      setTimestamps([...hist.timestamps]);
      setSeriesMap({ ...hist.seriesMap });
    }
  }, [maxPoints, historyRef, deviceType, version]);

  const COLORS = ['#36a2eb','#ff6384','#4bc0c0','#9966ff','#ff9f40','#2ecc71','#e74c3c','#3498db','#9b59b6','#16a085'];

  if (!deviceType) {
    return <div className="panel"><div className="section-title">{title}</div><div>Select a device to start polling.</div></div>;
  }
  if (!entry) {
    return <div className="panel"><div className="section-title">{title}</div><div>No latest data found for {deviceType}.</div></div>;
  }
  if (numericFields.length === 0) {
    return <div className="panel"><div className="section-title">{title}</div><div>No numeric fields to chart for {deviceType}.</div></div>;
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="section-title" style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
      {numericFields.map((field, idx) => {
        const data = {
          labels: timestamps,
          datasets: [{
            label: deviceType ? `${deviceType} • ${field}` : field,
            data: seriesMap[field] || [],
            borderColor: COLORS[idx % COLORS.length],
            backgroundColor: 'transparent',
            tension: 0.15,
          }]
        };
        const options: any = {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: { display: false },
            title: { display: true, text: deviceType ? `${deviceType} • ${field}` : field, font: { size: 16, weight: 'bold' } },
            tooltip: {
              enabled: true,
              displayColors: false,
              callbacks: {
                title: () => '',
                label: (ctx: any) => {
                  const v = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw;
                  return String(v);
                }
              }
            }
          },
          scales: { x: { display: true, title: { display: false }, ticks: { display: false } }, y: { display: true } }
        };
        return (
          <div key={field} style={{ height, marginBottom: 10 }}>
            <Line data={data} options={options} />
          </div>
        );
      })}
      <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>Max {maxPoints} points; older points are dropped.</div>
    </div>
  );
}

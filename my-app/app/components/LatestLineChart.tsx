"use client";
import React, { useMemo, useEffect, useState, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type LatestLineChartProps = {
  deviceMap: Record<string, any> | undefined;
  deviceType?: string;
  dataType?: string[];
  maxPoints?: number; // default 10
  title?: string;
  height?: number; // per-chart height, default 180
};

export default function LatestLineChart({ deviceMap, deviceType, dataType, maxPoints = 10, title = "Realtime Line Chart", height = 180 }: LatestLineChartProps) {
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
  const lastTsRef = useRef<string | undefined>(undefined);

  // Reset series when device or selected fields change
  useEffect(() => {
    setTimestamps([]);
    setSeriesMap({});
    lastTsRef.current = undefined;
  }, [deviceType, dataType]);

  // Append point for all numeric fields on each poll
  useEffect(() => {
    if (!entry || numericFields.length === 0) return;
    const tsRaw = entry["Timestamp"];
    let ts = typeof tsRaw === 'string' ? tsRaw : String(tsRaw ?? '');
    if (ts.includes('T')) ts = ts.split('.') [0].replace('T', ' ');

    const isNew = lastTsRef.current !== ts;
    if (isNew) {
      setTimestamps(prev => {
        const next = [...prev, ts];
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      });
      lastTsRef.current = ts;
    }

    setSeriesMap(prev => {
      const next: Record<string, number[]> = { ...prev };
      numericFields.forEach((field) => {
        const val = entry[field];
        if (typeof val !== 'number' || !Number.isFinite(val)) return;
        const arr = next[field] ? [...next[field]] : [];
        if (isNew) {
          arr.push(Number(val));
        } else if (arr.length > 0) {
          arr[arr.length - 1] = Number(val);
        } else {
          arr.push(Number(val));
        }
        if (arr.length > maxPoints) {
          next[field] = arr.slice(arr.length - maxPoints);
        } else {
          next[field] = arr;
        }
      });
      Object.keys(next).forEach((k) => { if (!numericFields.includes(k)) delete next[k]; });
      return next;
    });
  }, [entry, numericFields, maxPoints]);

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
      <div className="section-title">{title}</div>
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
            title: { display: true, text: deviceType ? `${deviceType} • ${field}` : field },
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
          scales: { x: { display: true, title: { display: true, text: 'Time' } }, y: { display: true } }
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
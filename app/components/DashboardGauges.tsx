"use client";
import React from "react";
import GaugeCard from "./GaugeCard";

// The rest of the code (inferRange and LatestDashboard) remains UNCHANGED
function inferRange(key: string, value: number) {
  const FIELD_RANGES: Record<string, { max: number; unit?: string; color?: string }> = {
    DSI: { max: 31, unit: 'Days', color: '#f2a007' },
    DSO: { max: 31, unit: 'Days', color: '#ff4d57' },
    DPO: { max: 31, unit: 'Days', color: '#11a36f' },
    CurrentRatio: { max: 5, unit: '%', color: '#2b6ea6' },
    Humidity: { max: 100, unit: '%', color: '#26b6b2' },
    Temperature: { max: 50, unit: '°C', color: '#ff9f40' },
    CO2: { max: 2000, unit: 'ppm', color: '#9966ff' },
    PM2_5: { max: 200, unit: 'µg/m³', color: '#4bc0c0' },
    PM10: { max: 200, unit: 'µg/m³', color: '#36a2eb' },
    Battery: { max: 100, unit: '%', color: '#2ecc71' },
  };
  const fallbackUnit = '';
  const entry = FIELD_RANGES[key];
  if (entry) return entry;
  if (value <= 1) return { max: 1, unit: fallbackUnit, color: '#26b6b2' };
  if (value <= 10) return { max: 10, unit: fallbackUnit, color: '#26b6b2' };
  if (value <= 100) return { max: 100, unit: fallbackUnit, color: '#26b6b2' };
  if (value <= 1000) return { max: 1000, unit: fallbackUnit, color: '#26b6b2' };
  return { max: Math.ceil(value * 1.2), unit: fallbackUnit, color: '#26b6b2' };
}

export function LatestDashboard({ deviceMap, device, dataType, compact = false }: any) {
  if (!deviceMap || !device || device.length === 0) {
    return <pre>No latest data yet</pre>;
  }
  const cards: any[] = [];
  device.forEach((dev: string) => {
    const entry = deviceMap[dev];
    if (!entry) return;
    const ts = entry["Timestamp"]?.split(".")[0]?.replace("T", " ");
    const keys = Object.keys(entry).filter(k => 
      !["Timestamp", "DeviceID", "DeviceType"].includes(k) && typeof entry[k] === 'number'
    );
    const selected = dataType && dataType.length > 0 
      ? keys.filter(k => dataType.includes(k)) 
      : keys;
    selected.forEach(k => {
      const { max, unit } = inferRange(k, Number(entry[k]));
      const warning = max * 0.7;
      const danger = max * 0.9;
      cards.push({ title: `${dev} • ${k}`, subtitle: ts || '', value: Number(entry[k]), min: 0, max, unit, thresholds: { warning, danger } });
    });
  });
  if (cards.length === 0) return <pre>No numeric fields to display</pre>;
  return (
    <div>
      <div style={{ marginBottom: 8, opacity: 0.7 }}>Latest timestamp: {cards[0].ts || '-'}</div>
      <div className="dashboard-grid" style={{ 
        gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 160 : 220}px, 1fr))`, 
        gap: compact ? 12 : 16 
      }}>
        {cards.map((c, idx) => (
          <GaugeCard key={idx} {...c} />
        ))}
      </div>
    </div>
  );
}

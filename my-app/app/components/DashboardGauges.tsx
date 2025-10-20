"use client";
import React from "react";
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// Center text plugin for Doughnut
const centerTextPlugin: any = {
  id: 'centerText',
  afterDraw(chart: any) {
    const { width } = chart;
    const ctx = chart.ctx;
    const dataset = chart.data.datasets?.[0];
    const value = Array.isArray(dataset?.data) ? dataset?.data[0] : undefined;
    const label = chart.data?.labels?.[0];
    const unit = chart?.options?.plugins?.centerText?.unit || '';
    const color = chart?.options?.plugins?.centerText?.color || '#111';
    const subColor = chart?.options?.plugins?.centerText?.subColor || '#666';
    const fontSize = chart?.options?.plugins?.centerText?.fontSize || 18;

    if (value == null) return;

    ctx.save();
    ctx.font = `700 ${fontSize}px system-ui`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), width / 2, chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2);

    if (unit) {
      ctx.font = `600 ${(fontSize * 0.8)}px system-ui`;
      ctx.fillStyle = subColor;
      ctx.fillText(String(unit), width / 2, chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2 + fontSize);
    }

    if (label) {
      ctx.font = `600 ${(fontSize * 0.7)}px system-ui`;
      ctx.fillStyle = subColor;
      ctx.fillText(String(label), width / 2, chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2 - fontSize);
    }

    ctx.restore();
  }
};
ChartJS.register(centerTextPlugin);

export function GaugeCard({ title, value, max = 100, unit = '', color = '#26b6b2' }: any) {
  const v = Math.max(0, Math.min(Number(value), Number(max)));
  const remainder = Math.max(0, Number(max) - v);
  const data = {
    labels: ['Value', 'Remaining'],
    datasets: [{
      label: title,
      data: [v, remainder],
      backgroundColor: [color, '#d7d9dd'],
      hoverOffset: 4,
      borderWidth: 0,
    }]
  };
  const optionsGauge: any = {
    responsive: true,
    rotation: -125,
    circumference: Math.PI * 80,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      title: { display: false },
      centerText: { unit, color: '#111', subColor: '#666', fontSize: 20 }
    },
  };
  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Doughnut data={data} options={optionsGauge} />
      </div>
    </div>
  );
}

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

export function LatestDashboard({ deviceMap, device, dataType }: any) {
  if (!deviceMap || !device || device.length === 0) {
    return <pre>No latest data yet</pre>;
  }

  const cards: any[] = [];
  device.forEach((dev: string) => {
    const entry = deviceMap[dev];
    if (!entry) return;
    const ts = entry["Timestamp"]?.split(".")[0]?.replace("T", " ");
    const keys = Object.keys(entry).filter(k => !["Timestamp", "DeviceID", "DeviceType"].includes(k) && typeof entry[k] === 'number');
    const selected = dataType && dataType.length > 0 ? keys.filter(k => dataType.includes(k)) : keys;
    selected.forEach(k => {
      const { max, unit, color } = inferRange(k, Number(entry[k]));
      cards.push({ title: `${dev} • ${k}`, value: Number(entry[k]), max, unit, color, ts });
    });
  });

  if (cards.length === 0) return <pre>No numeric fields to display</pre>;

  return (
    <div>
      <div style={{ marginBottom: 8, opacity: 0.7 }}>Latest timestamp: {cards[0].ts || '-'}</div>
      <div className="dashboard-grid">
        {cards.map((c, idx) => (
          <GaugeCard key={idx} title={c.title} value={c.value} max={c.max} unit={c.unit} color={c.color} />
        ))}
      </div>
    </div>
  );
}
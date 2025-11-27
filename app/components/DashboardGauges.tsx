"use client";
import React, { useRef, useEffect } from "react";
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export function GaugeCard({ title, value, max = 100, unit = '', color = '#26b6b2', compact = false }: any) {
  const v = Math.max(0, Math.min(Number(value), Number(max)));
  const remainder = Math.max(0, Number(max) - v);
  const fontSize = compact ? 16 : 20;
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize handling to keep chart centered
  useEffect(() => {
    const handleResize = () => {
      const parent = containerRef.current?.querySelector('canvas')?.parentElement as any;
      parent?.forceUpdate?.();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [compact]);

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
    maintainAspectRatio: false,
    rotation: -125,
    circumference: Math.PI * 80,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      title: { display: false },
    },
    layout: { padding: 0 }
  };

  // Merge value and unit into one string (add space between if unit exists)

  return (
    <div className="panel" style={{ padding: compact ? 10 : 12 }}>
      {/* Title above gauge */}
      <div style={{ fontWeight: 800, marginBottom: 8, textAlign: 'center', fontSize: compact ? 18 : 22 }}>{title}</div>
      
      {/* Gauge container */}
      <div 
        ref={containerRef}
        style={{ 
          height: compact ? 120 : 150, 
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Doughnut Chart */}
        <Doughnut 
          data={data} 
          options={optionsGauge} 
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Centered text overlay - value + unit together */}
        <div style={{
          position: 'absolute',
          textAlign: 'center',
          pointerEvents: 'none',
          // Keep original perfect centering
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          lineHeight: 1,
        }}>
          {/* Main value + unit (single line, same format as before) */}
          <div style={{
            fontSize: `${fontSize}px`,
            fontWeight: 800,
            color: '#111',
            marginTop: 30,
            display: 'block',
          }}>
            <span style={{ fontSize: "22px", fontWeight: "bold" }}>{String(v)}</span>
            {unit && <span style={{ fontSize: "14px" }}> {unit}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      const { max, unit, color } = inferRange(k, Number(entry[k]));
      cards.push({ title: `${dev} • ${k}`, value: Number(entry[k]), max, unit, color, ts });
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
          <GaugeCard key={idx} {...c} compact={compact} />
        ))}
      </div>
    </div>
  );
}

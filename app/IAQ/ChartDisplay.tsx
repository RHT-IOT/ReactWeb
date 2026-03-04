"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { IAQData } from './Dashboard';

interface ChartDisplayProps {
  data: IAQData[];
}

export function ChartDisplay({ data }: ChartDisplayProps) {
  const chartData = data.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    Temperature: Number(d.temperature.toFixed(1)),
    Humidity: Number(d.humidity.toFixed(0)),
    CO2: Number((d.co2 / 10).toFixed(0)), // Scale down for visibility
    PM25: Number(d.pm25.toFixed(1)),
    TVOC: Number((d.tvoc / 10).toFixed(1)), // Scale down for visibility
    PM10: Number(d.pm10.toFixed(1)),
  }));

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-700 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-3">24-Hour Trends</h2>
      
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend 
            wrapperStyle={{ color: '#94a3b8' }}
            iconSize={10}
          />
          <Line 
            type="monotone" 
            dataKey="Temperature" 
            stroke="#f97316" 
            strokeWidth={2}
            dot={false}
            name="Temperature (°C)"
          />
          <Line 
            type="monotone" 
            dataKey="Humidity" 
            stroke="#06b6d4" 
            strokeWidth={2}
            dot={false}
            name="Humidity (%)"
          />
          <Line 
            type="monotone" 
            dataKey="CO2" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false}
            name="CO₂ (ppm ÷10)"
          />
          <Line 
            type="monotone" 
            dataKey="PM25" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={false}
            name="PM2.5 (µg/m³)"
          />
          <Line 
            type="monotone" 
            dataKey="TVOC" 
            stroke="#a855f7" 
            strokeWidth={2}
            dot={false}
            name="TVOC (ppb ÷10)"
          />
          <Line 
            type="monotone" 
            dataKey="PM10" 
            stroke="#f43f5e" 
            strokeWidth={2}
            dot={false}
            name="PM10 (µg/m³)"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Temperature</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
          <span>Humidity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span>CO₂ (scaled)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span>PM2.5</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span>TVOC (scaled)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
          <span>PM10</span>
        </div>
      </div>
    </div>
  );
}
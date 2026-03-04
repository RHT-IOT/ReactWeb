import { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { MetricCard } from './MetricCard';
import { ChartDisplay } from './ChartDisplay';
import { getDPFromTime, getIMEIList, getLatestDP, LatestDPResult } from '../lib/aws';

import { asset } from "../lib/asset";
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Cloud, 
  Zap,
  Activity,
  Home
} from 'lucide-react';

export interface IAQData {
  temperature: number;
  humidity: number;
  hcho: number;
  tvoc: number;
  co2: number;
  pm25: number;
  pm10: number;
  timestamp: number;
}

const HISTORY_POINTS = 24;
const UTC_PLUS_8_OFFSET_MINUTES = 8 * 60;

const IAQ_FIELD_KEYS = {
  temperature: ['Temperature', 'Temp', 'TEMP', 'temp', 'temperature', 'T'],
  humidity: ['Humidity', 'Hum', 'HUM', 'hum', 'humidity', 'RH'],
  hcho: ['HCHO', 'hcho', 'CH2O', 'Formaldehyde'],
  tvoc: ['TVOC', 'tvoc', 'VOC', 'Voc'],
  co2: ['CO2', 'co2', 'CO₂', 'co_2'],
  pm25: ['PM2_5', 'PM2.5', 'PM25', 'pm2_5', 'pm2.5', 'pm25'],
  pm10: ['PM10', 'pm10'],
  timestamp: ['Timestamp', 'timestamp', 'Time', 'time'],
};

const toNumber = (value: any) => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getFirstNumber = (entry: any, keys: string[]) => {
  if (!entry || typeof entry !== 'object') return 0;
  for (const key of keys) {
    if (key in entry) {
      const num = toNumber((entry as any)[key]);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
};

const hasNumericKey = (entry: any, keys: string[]) => {
  if (!entry || typeof entry !== 'object') return false;
  return keys.some((key) => key in entry && Number.isFinite(toNumber((entry as any)[key])));
};

const getTimestamp = (entry: any) => {
  if (!entry || typeof entry !== 'object') return Date.now();
  for (const key of IAQ_FIELD_KEYS.timestamp) {
    if (key in entry) {
      const raw = (entry as any)[key];
      const parsed = typeof raw === 'number' ? raw : Date.parse(String(raw));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return Date.now();
};

const scoreEntry = (entry: any) => {
  let score = 0;
  score += hasNumericKey(entry, IAQ_FIELD_KEYS.temperature) ? 1 : 0;
  score += hasNumericKey(entry, IAQ_FIELD_KEYS.humidity) ? 1 : 0;
  score += hasNumericKey(entry, IAQ_FIELD_KEYS.co2) ? 1 : 0;
  score += hasNumericKey(entry, IAQ_FIELD_KEYS.pm25) ? 1 : 0;
  score += hasNumericKey(entry, IAQ_FIELD_KEYS.pm10) ? 1 : 0;
  return score;
};

const mapEntryToIAQ = (entry: any): IAQData => ({
  temperature: getFirstNumber(entry, IAQ_FIELD_KEYS.temperature),
  humidity: getFirstNumber(entry, IAQ_FIELD_KEYS.humidity),
  hcho: getFirstNumber(entry, IAQ_FIELD_KEYS.hcho),
  tvoc: getFirstNumber(entry, IAQ_FIELD_KEYS.tvoc),
  co2: getFirstNumber(entry, IAQ_FIELD_KEYS.co2),
  pm25: getFirstNumber(entry, IAQ_FIELD_KEYS.pm25),
  pm10: getFirstNumber(entry, IAQ_FIELD_KEYS.pm10),
  timestamp: getTimestamp(entry),
});


const pickBestEntry = (result: LatestDPResult | null) => {
  if (!result?.deviceMap) return null;
  let best: { entry: any; deviceType?: string } | null = null;
  Object.entries(result.deviceMap).forEach(([deviceType, entry]) => {
    const score = scoreEntry(entry);
    if (!best || score > scoreEntry(best.entry)) {
      best = { entry, deviceType };
    }
  });
  return best;
};

const pickBestDeviceTypeFromItems = (items: any[]) => {
  const scores = new Map<string, number>();
  items.forEach((item) => {
    const dt = String(item?.DeviceType ?? item?.deviceType ?? '');
    if (!dt) return;
    const score = scoreEntry(item);
    const current = scores.get(dt) ?? 0;
    if (score > current) scores.set(dt, score);
  });
  let bestType: string | null = null;
  let bestScore = -1;
  scores.forEach((score, dt) => {
    if (score > bestScore) {
      bestScore = score;
      bestType = dt;
    }
  });
  return bestType;
};

// Generate mock historical data
const generateHistoricalData = (): IAQData[] => {
  const data: IAQData[] = [];
  const now = Date.now();
  
  for (let i = 23; i >= 0; i--) {
    data.push({
      temperature: 20 + Math.random() * 5,
      humidity: 45 + Math.random() * 15,
      hcho: 0.01 + Math.random() * 0.05,
      tvoc: 100 + Math.random() * 150,
      co2: 400 + Math.random() * 200,
      pm25: 5 + Math.random() * 15,
      pm10: 10 + Math.random() * 20,
      timestamp: now - i * 3600000, // hourly data for 24 hours
    });
  }
  
  return data;
};

export function Dashboard() {
  const auth = useAuth();
  const [imei, setImei] = useState<string | null>(null);
  const [activeDeviceType, setActiveDeviceType] = useState<string | null>(null);

  const [currentData, setCurrentData] = useState<IAQData>({
    temperature: 22.5,
    humidity: 52,
    hcho: 0.03,
    tvoc: 180,
    co2: 520,
    pm25: 12,
    pm10: 18,
    timestamp: Date.now(),
  });
  
  const [historicalData, setHistoricalData] = useState<IAQData[]>(generateHistoricalData());


  const getIdToken = useCallback(async () => {
    try {
      const fn: any = (auth as any)?.signinSilent;
      if (typeof fn === 'function') {
        const user = await fn();
        const tk = (user as any)?.id_token;
        if (tk) return tk;
      }
    } catch {}
    return auth.user?.id_token as string;
  }, [auth]);

  const toUtcOffsetIso = useCallback((date: Date) => {
    const shifted = new Date(date.getTime() + UTC_PLUS_8_OFFSET_MINUTES * 60 * 1000);
    return shifted.toISOString().replace('Z', '+08:00');
  }, []);

  const getTimeRange = useCallback(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return {
      startISO: toUtcOffsetIso(start),
      endISO: toUtcOffsetIso(end),
    };
  }, [toUtcOffsetIso]);

  const fetchHistoricalDataFromDatabase = useCallback(async (): Promise<IAQData[]> => {
    if (!imei || !auth.user?.id_token) return generateHistoricalData();
    try {
      const { startISO, endISO } = getTimeRange();
      const result = await getDPFromTime(imei, startISO, endISO, auth.user.id_token as string, '60', getIdToken);
      const items = Array.isArray(result?.items) ? result.items : [];
      const deviceType = activeDeviceType ?? pickBestDeviceTypeFromItems(items);
      if (deviceType) setActiveDeviceType(deviceType);
      const filtered = deviceType ? items.filter((item) => String(item?.DeviceType ?? item?.deviceType) === deviceType) : items;
      const mapped = filtered.map(mapEntryToIAQ).sort((a, b) => a.timestamp - b.timestamp);
      return mapped.length > 0 ? mapped.slice(-HISTORY_POINTS) : generateHistoricalData();
    } catch (error) {
      console.error('Error fetching historical data from database:', error);
      return generateHistoricalData();
    }
  }, [activeDeviceType, auth.user?.id_token, getIdToken, getTimeRange, imei]);

  const fetchLatestDataFromDatabase = useCallback(async (): Promise<IAQData | null> => {
    if (!imei || !auth.user?.id_token) return null;
    try {
      const result = await getLatestDP(imei, auth.user.id_token as string, getIdToken);
      const selected = pickBestEntry(result);
      if (!selected) return null;
      setActiveDeviceType(selected.deviceType ?? null);
      return mapEntryToIAQ(selected.entry);
    } catch (error) {
      console.error('Error fetching data from database:', error);
      return null;
    }
  }, [auth.user?.id_token, getIdToken, imei]);

  // Resolve IMEI once authenticated
  useEffect(() => {
    const loadImei = async () => {
      if (!auth.isAuthenticated || !auth.user?.id_token || !auth.user?.profile?.email) return;
      if (imei) return;
      try {
        const res = await getIMEIList(auth.user.profile.email as string, auth.user.id_token as string, getIdToken);
        const items = Array.isArray(res.items) ? res.items : [];
        let stored: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            stored = localStorage.getItem('selected-imei');
          } catch {}
        }
        const storedMatch = stored
          ? items.find((it: any) => String(it?.DeviceID ?? '') === String(stored))
          : null;
        const preferred = storedMatch?.DeviceID ?? items[0]?.DeviceID;
        if (preferred !== undefined && preferred !== null) setImei(String(preferred));
      } catch (error) {
        console.error('Error fetching IMEI list:', error);
      }
    };
    loadImei();
  }, [auth.isAuthenticated, auth.user?.id_token, auth.user?.profile?.email, getIdToken, imei]);

  // Load initial historical data from database
  useEffect(() => {
    const loadHistoricalData = async () => {
      const data = await fetchHistoricalDataFromDatabase();
      setHistoricalData(data);
    };
    
    loadHistoricalData();
  }, [fetchHistoricalDataFromDatabase]);

  // Refresh hourly averages for chart once per hour
  useEffect(() => {
    if (!imei || !auth.user?.id_token) return;
    const applyHourlyRange = async () => {
      const data = await fetchHistoricalDataFromDatabase();
      setHistoricalData(data);
    };
    applyHourlyRange();
    const hourlyTimer = window.setInterval(() => {
      applyHourlyRange();
    }, 60 * 60 * 1000);

    return () => {
      window.clearInterval(hourlyTimer);
    };
  }, [auth.user?.id_token, fetchHistoricalDataFromDatabase, imei]);

  // Refresh metrics every minute
  useEffect(() => {
    if (!imei || !auth.user?.id_token) return;
    const applyLatest = async () => {
      const data = await fetchLatestDataFromDatabase();
      if (data) setCurrentData(data);
    };
    applyLatest();
    const latestTimer = window.setInterval(() => {
      applyLatest();
    }, 60 * 1000);
    return () => {
      window.clearInterval(latestTimer);
    };
  }, [auth.user?.id_token, fetchLatestDataFromDatabase, imei]);
  const getAQIStatus = () => {
    if (currentData.pm10 < 20 && currentData.co2 < 800 && currentData.tvoc < 200 && currentData.hcho < 30 && currentData.tvoc < 200) return { label: 'Good', color: 'text-emerald-400' };
    if (currentData.pm10 < 100 && currentData.co2 < 1000 && currentData.tvoc < 600 && currentData.hcho < 100&& currentData.tvoc < 600) return { label: 'Moderate', color: 'text-yellow-400' };
    return { label: 'Poor', color: 'text-red-400' };
  };

  const status = getAQIStatus();

  const handleReturnHome = () => {
    window.location.replace(asset('/login'));
    console.log('Return to home');
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Indoor Air Quality Monitor
            </h1>
            <button
              onClick={handleReturnHome}
              className="flex items-center gap-2 bg-slate-800/30 hover:bg-slate-800/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all text-slate-400 hover:text-slate-300"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm">Return Home</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <p className="text-slate-400">Live monitoring • Last update: {new Date(currentData.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Status Card */}
        <div className="mb-4 bg-gradient-to-r from-slate-800/80 to-slate-700/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-700 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Air Quality Status</p>
              <p className={`text-3xl font-bold ${status.color}`}>{status.label}</p>
            </div>
            <Activity className={`w-12 h-12 ${status.color}`} />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Temperature"
            value={currentData.temperature.toFixed(1)}
            unit="°C"
            icon={<Thermometer className="w-6 h-6" />}
            color="from-orange-500 to-red-500"
          />
          <MetricCard
            title="Humidity"
            value={currentData.humidity.toFixed(0)}
            unit="%"
            icon={<Droplets className="w-6 h-6" />}
            color="from-blue-500 to-cyan-500"
          />
          <MetricCard
            title="HCHO"
            value={currentData.hcho.toFixed(3)}
            unit="mg/m³"
            icon={<Wind className="w-6 h-6" />}
            color="from-purple-500 to-pink-500"
          />
          <MetricCard
            title="TVOC"
            value={currentData.tvoc.toFixed(0)}
            unit="ppb"
            icon={<Cloud className="w-6 h-6" />}
            color="from-indigo-500 to-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard
            title="CO₂"
            value={currentData.co2.toFixed(0)}
            unit="ppm"
            icon={<Cloud className="w-6 h-6" />}
            color="from-green-500 to-emerald-500"
          />
          <MetricCard
            title="PM2.5"
            value={currentData.pm25.toFixed(1)}
            unit="µg/m³"
            icon={<Wind className="w-6 h-6" />}
            color="from-amber-500 to-orange-500"
          />
          <MetricCard
            title="PM10"
            value={currentData.pm10.toFixed(1)}
            unit="µg/m³"
            icon={<Wind className="w-6 h-6" />}
            color="from-rose-500 to-red-500"
          />
        </div>

        {/* Chart */}
        <ChartDisplay data={historicalData} />
      </div>
    </div>
  );
}
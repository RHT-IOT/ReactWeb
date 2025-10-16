// App.js
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import Form from 'react-bootstrap/Form';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import DateTimeRangePickerValue from "./datepicker";
import dayjs from "dayjs";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, ArcElement);
// Plugin to draw the value (and optional unit) in the center of the doughnut
const centerTextPlugin: any = {
  id: 'centerText',
  afterDraw(chart: any) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;
    const arc = meta.data[0];
    const x = arc.x;
    const y = arc.y;
    const opts = chart.options?.plugins?.centerText || {};
    const value = chart.data?.datasets?.[0]?.data?.[0]; // first segment is value
    if (value === undefined || value === null) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = opts.fontSize || 20;
    const fontFamily = opts.fontFamily || 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = opts.color || '#111';
    ctx.fillText(String(value), x, y);
    if (opts.unit) {
      ctx.font = `400 ${Math.round(fontSize * 0.65)}px ${fontFamily}`;
      ctx.fillStyle = opts.subColor || '#555';
      ctx.fillText(String(opts.unit), x, y + fontSize * 0.9);
    }
    ctx.restore();
  }
};
ChartJS.register(centerTextPlugin);
function SelectBasicExample({ IMEI , setValue, setcurrdev, setdevarr}) {
  const handleSelect=(e)=>{
    if(e.target.value){
      console.log(e.target.value);
      setValue(e.target.value)
      setcurrdev([]);
      setdevarr([]);
    }
  }
  return (
    <Form.Select className="brand-select" aria-label="Default select example" onChange={handleSelect}>
      <option value="">Choose your IMEI code</option>
       {IMEI.map((opt, index) => (
          <option key={index} value={opt}>
            {opt}
          </option>
        ))}
    </Form.Select>
  );
}
function DropboxDev({ devicearr, setcurrdev}) {
  if(!devicearr){
    return (<p>click refresh</p>);
  }
  const handleMultiSelect=(e)=>{
    const selectedKeys = Array.from(e.target.selectedOptions).map(opt => opt.value);
    const values = selectedKeys.map(key => Array.isArray(devicearr) ? devicearr[key] : devicearr[key]);
    console.log("set devices:", values);
    setcurrdev(values);
  };
  const entries = Array.isArray(devicearr)
    ? devicearr.map((val, idx) => [String(idx), val])
    : Object.entries(devicearr);
  return (
    <Form.Select multiple size={Math.min(entries.length, 6)} className="brand-select" aria-label="Select devices" onChange={handleMultiSelect}>
      {entries.map(([key, value]) => (
        <option key={key} value={key}>
          {value}
        </option>
      ))}
    </Form.Select>
  );
}

function DataTypeDropdown({ timeSeriesData, device, dataType, setDataType }) {
  if (!timeSeriesData || timeSeriesData.length === 0 || !device || device.length === 0) {
    return <p>Select device(s) first</p>;
  }

  const meta = new Set(["DeviceID", "DeviceType", "Timestamp"]);
  const deviceItems = timeSeriesData.filter(i => device.includes(i.DeviceType));
  const dataFields = Array.from(new Set(
    deviceItems.flatMap(i => Object.keys(i).filter(k => !meta.has(k) && typeof i[k] === 'number'))
  ));

  if (dataFields.length === 0) {
    return <p>No numeric data available</p>;
  }

  const handleMultiSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
    setDataType(selected);
  };

  return (
    <Form.Select multiple size={Math.min(dataFields.length, 6)} className="brand-select" aria-label="Select data types" value={dataType} onChange={handleMultiSelect}>
      {dataFields.map(field => (
        <option key={field} value={field}>
          {field}
        </option>
      ))}
    </Form.Select>
  );
}

function Table_disp({deviceMap, device}){
  if(!deviceMap || !device || device.length === 0){
    return(<pre> No data Yet </pre>);
  }
  const rows = device.flatMap(dev => {
    const entry = deviceMap[dev];
    if(!entry) return [];
    const ts = entry["Timestamp"].split(".")[0].replace("T", " ");
    return Object.entries(entry)
      .filter(([key]) => key !== "Timestamp" && key !== "DeviceID" && key !== "DeviceType")
      .map(([key, value]) => ({ device: dev, key, value: String(value), ts }));
  });
  return(
    <table border="1" style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th>Device</th>
          <th>Variable</th>
          <th>Value</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={`${r.device}-${r.key}-${idx}`}>
            <td>{r.device}</td>
            <td>{r.key}</td>
            <td>{r.value}</td>
            <td>{r.ts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Gauge card to visualize a single numeric field
function GaugeCard({ title, value, max = 100, unit = '', color = '#26b6b2' }: any) {
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
      <div style={{ height: 150, position: 'relative' }}>
        <Doughnut data={data} options={optionsGauge} />
      </div>
      {/* <div style={{ textAlign: 'center', opacity: 0.7, fontSize: 12 }}>0 – {max}</div> */}
    </div>
  );
}

// Dashboard of gauges for latest DP entries
function LatestDashboard({ deviceMap, device, dataType }: any) {
  if (!deviceMap || !device || device.length === 0) {
    return <pre>No latest data yet</pre>;
  }
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
  const inferRange = (key: string, value: number) => {
    const preset = FIELD_RANGES[key];
    if (preset) return preset;
    const k = key.toLowerCase();
    if (k.includes('hum')) return { max: 100, unit: '%', color: '#26b6b2' };
    if (k.includes('temp')) return { max: 50, unit: '°C', color: '#ff9f40' };
    if (k.includes('ratio') || k.includes('%')) return { max: 100, unit: '%', color: '#2b6ea6' };
    if (k.includes('co2')) return { max: 2000, unit: 'ppm', color: '#9966ff' };
    if (k.includes('pm')) return { max: 200, unit: 'µg/m³', color: '#4bc0c0' };
    return { max: Math.max(100, Math.ceil(value * 1.5) || 100), unit: '', color: '#26b6b2' };
  };

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
const ExportCSVButton = ({ data, filename = "export.csv" }) => {
  const convertToCSV = (arr) => {
    if (!arr || arr.length === 0) return "";

    // Define the order you want
    const fixedOrder = ["DeviceID", "Timestamp", "DeviceType"];

    // Collect all other keys dynamically (excluding the fixed ones)
    const otherKeys = Array.from(
      arr.reduce((set, obj) => {
        Object.keys(obj).forEach((k) => {
          if (!fixedOrder.includes(k)) set.add(k);
        });
        return set;
      }, new Set())
    );

    // Final header order
    const keys = [...fixedOrder, ...otherKeys];

    // Header row
    const header = keys.join(",") + "\n";

    // Data rows
    const rows = arr
      .map((obj) =>
        keys
          .map((k) => {
            let val = obj[k] ?? "";
            if (typeof val === "string") {
              val = `"${val.replace(/"/g, '""')}"`; // escape quotes
            }
            return val;
          })
          .join(",")
      )
      .join("\n");

    return header + rows;
  };

  const downloadCSV = () => {
    if (!data || data.length === 0) {
      alert("No data to export");
      return;
    }
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return <button className="brand-button" onClick={downloadCSV}>Download CSV</button>;
};

function App() {
  const auth = useAuth();
  const [userInfo, setUserInfo] = useState({ username: "" , name: ""});
  const [IMEI_ARR, setIMEI_ARR] = useState([]);
  const [IMEI,setIMEI]=useState('');
  const [deviceMap, setDeviceMap]=useState('');
  const [timestamp, setTimestamp]=useState('');
  const [deviceType, setDeviceType]=useState('');
  const [device, setDevice]=useState<string[]>([]);
  const [startDateTime, setStartDateTime]=useState('');
  const [endDateTime, setEndDateTime]=useState('');
  const [dataType, setDataType] = useState<string[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  // Theme state
  const [theme, setTheme] = useState<'theme-a' | 'theme-b' | 'theme-c'>('theme-b');
  const [logoSrc, setLogoSrc] = useState('/logos/logo1.png');
  const [mode, setMode] = useState<'mode-light' | 'mode-dark'>('mode-light');
  // Dynamic brand title per theme
  const brandTitle = theme === 'theme-a' ? 'RHT Limited' : theme === 'theme-b' ? 'CMA testing' : 'Natsense';
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Sensor Data Time Series',
    },
    legend: {
      display: true
    }
  },
  scales: {
    x: {
      type: 'time',
      time: {
        unit: 'minute'
      },
      title: {
        display: true,
        text: 'Timestamp'
      },
      
    },
    y: {
      title: {
        display: true,
        text: Array.isArray(dataType) && dataType.length === 1 ? dataType[0] : 'Value'
      }
    }
  }
};
  // Initialize theme & mode from localStorage and apply to body
  useEffect(() => {
    const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('theme-name')) as 'theme-a' | 'theme-b' | 'theme-c' | null;
    const themeToApply = savedTheme || 'theme-a';
    setTheme(themeToApply);
    const logoIndex = themeToApply === 'theme-a' ? 1 : themeToApply === 'theme-b' ? 2 : 3;
    setLogoSrc(`/logos/logo${logoIndex}.png`);

    const savedMode = (typeof window !== 'undefined' && localStorage.getItem('mode-name')) as 'mode-light' | 'mode-dark' | null;
    const modeToApply = savedMode || 'mode-light';
    setMode(modeToApply);

    const cls = document.body.classList;
    cls.remove('theme-a', 'theme-b', 'theme-c', 'mode-light', 'mode-dark');
    cls.add(themeToApply);
    cls.add(modeToApply);
  }, []);

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'theme-a' | 'theme-b' | 'theme-c';
    setTheme(value);
    localStorage.setItem('theme-name', value);
    const logoIndex = value === 'theme-a' ? 1 : value === 'theme-b' ? 2 : 3;
    setLogoSrc(`/logos/logo${logoIndex}.png`);
    const cls = document.body.classList;
    cls.remove('theme-a', 'theme-b', 'theme-c');
    cls.add(value);
  };
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'mode-light' | 'mode-dark';
    setMode(value);
    localStorage.setItem('mode-name', value);
    const cls = document.body.classList;
    cls.remove('mode-light', 'mode-dark');
    cls.add(value);
  };
  useEffect(() => {
    const fetchUserInfo = async () => {

      console.log("Hi");
      if (auth.isAuthenticated) {
        const response = await fetch(
          "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com/oauth2/userInfo",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${auth.user?.access_token}`,
            },
          }
        );
        const data = await response.json();
        console.log("User Info:", data);
        setUserInfo(data);
      }
      
    };

    fetchUserInfo();
    const callApi = async (email) => {
      
    if(auth.isAuthenticated && email){
      const response = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getIMEI", {
        method: "POST",
        headers: { "Content-Type": "application/json" , 
          "Authorization": `Bearer ${auth.user?.id_token}`,},
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      const arr =  JSON.parse(data?.body);
      const flat = arr.flat(); 
      console.log("IMEI:", flat);
      setIMEI_ARR(flat);
    };
    
    }
    callApi(auth.user?.profile.email);
  }, [auth.isAuthenticated, auth.user?.access_token,auth.user?.profile.email,auth.user?.id_token]);
  
    const getLatestDp = () => {
    return fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getLatestDP", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      },
      body: JSON.stringify({ IMEI }),
    })
      .then(res => res.json())
      .then(data => {
        console.log("API response:", data);
        const temp = JSON.parse(data.body);
        const map = {};
        const dev = {};
        let idx = 0;
        for (const item of temp) {
          dev[idx] = item.DeviceType;
          map[item.DeviceType] = item;
          idx++;
        }
        setDeviceMap(map);
        setDeviceType(dev);
        console.log("dev arr:",dev);
        // do something with data here
      })
      .catch(err => console.error("Fetch error:", err));
  };
  const getDpfromtime = () => {
    return fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getDpFromTime", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      },
      body: JSON.stringify({ IMEI, startDateTime,endDateTime}),
    })
      .then(res => res.json())
      .then(data => {
        console.log("API response:", data);
        const temp = JSON.parse(data.body);
        setDeviceType(temp.deviceTypes || []);
        setTimeSeriesData(temp.items || []);
        console.log("time series:",temp.items || []);
        // const map = {};
        // const dev = {};
        // let idx = 0;
        // for (const item of temp) {
        //   dev[idx] = item.DeviceType;
        //   map[item.DeviceType] = item;
        //   idx++;
        // }
        // setDeviceMap(map);
        // setDeviceType(dev);
        // console.log("dev arr:",dev);
        // do something with data here
      })
      .catch(err => console.error("Fetch error:", err));
  };
  // Build chart data for selected device and data type
  const prepareChartData = () => {
    if (!device || device.length === 0 || !dataType || dataType.length === 0 || timeSeriesData.length === 0) {
      return { datasets: [] };
    }
    const colors = ['#36a2eb', '#ff6384', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf'];
    const datasets: any[] = [];
    device.forEach((dev, di) => {
      const deviceData = timeSeriesData.filter(item => item.DeviceType === dev);
      dataType.forEach((dt, ti) => {
        const points = deviceData
          .filter(item => typeof item[dt] === 'number')
          .map(item => ({ x: item.Timestamp.split('.') [0].replace('T', ' '), y: item[dt] }));
        if (points.length > 0) {
          const color = colors[(di * dataType.length + ti) % colors.length];
          datasets.push({
            label: `${dev} - ${dt}`,
            data: points,
            borderColor: color,
            backgroundColor: 'transparent',
            tension: 0.1,
          });
        }
      });
    });
    return { datasets };
  };

  const chartData = prepareChartData();
  const signOutRedirect = () => {
    const clientId = "7bj6qolgca3bbcshiuiinp9tj4";
    const logoutUri = `${window.location.origin}/`;
    const cognitoDomain = "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com";
    try { (auth as any)?.removeUser?.(); } catch {}
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };
  const refresh_send = {
      "Records": [
        {
          "eventName": "REFRESH"
        }
      ]
    };
  const Refresh = () => {
    return fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/Refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      },
      body: JSON.stringify(refresh_send),
    })
  };
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }
  if (auth.isAuthenticated) {
    return (
      <div className="page-container">
        {/* Theme header with logo and switcher */}
        <div className="brand-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logoSrc} alt="Company Logo" style={{ height: '36px' }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/next.svg'; }} />
            <span className="brand-title">{brandTitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* <select value={theme} onChange={handleThemeChange} className="brand-select">
              <option value="theme-a">Theme A</option>
              <option value="theme-b">Theme B</option>
              <option value="theme-c">Theme C</option>
            </select> */}
            <select value={mode} onChange={handleModeChange} className="brand-select">
              <option value="mode-light">Light</option>
              <option value="mode-dark">Dark</option>
            </select>
            <button className="brand-button button-outline" onClick={() => signOutRedirect()}>Sign out</button>            
          </div>
        </div>
        {/* Friendly hint */}
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="section-title">Welcome, {userInfo.username || 'User'}</div>
          <p style={{ margin: 0, opacity: 0.9 }}>Use Filters to select IMEI, device, data type and time range. Preview data and chart, then export CSV if needed.</p>
        </div>

        {/* Main grid: Filters and Preview */}
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="panel">
            <div className="section-title">Filters</div>
            <div className="control-row">
              <SelectBasicExample IMEI={IMEI_ARR} setValue={setIMEI} setcurrdev={setDevice} setdevarr={setDeviceType} />
            </div>
            <div className="control-row">
              <DropboxDev devicearr={deviceType} setcurrdev={setDevice} />
            </div>
            <div className="control-row">
              <DataTypeDropdown timeSeriesData={timeSeriesData} device={device} dataType={dataType} setDataType={setDataType} />
            </div>
            <div className="control-row">
              <DateTimeRangePickerValue setStartDateTime={setStartDateTime} setEndDateTime={setEndDateTime} />
            </div>
            <div className="control-row">
              <button className="brand-button" onClick={getLatestDp} style={{ marginRight: 8 }}>Get New Data</button>
              <button className="brand-button button-secondary" onClick={getDpfromtime}>Load Range</button>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">Latest Data Dashboard</div>
            <LatestDashboard deviceMap={deviceMap} device={device} dataType={dataType} />
            {chartData.datasets.length > 0 && (
              <div className="panel" style={{ marginTop: '16px' }}>
                <h3>Time Series Chart: {Array.isArray(device) ? device.join(', ') : device} - {Array.isArray(dataType) ? dataType.join(', ') : dataType}</h3>
                <div style={{ height: 500 }}>
                  <Line data={chartData} options={options} />
                </div>
              </div>
            )}
            {timeSeriesData.length > 0 && chartData.datasets.length === 0 && (
              <div style={{ marginTop: '20px', color: 'orange' }}>
                <p>No data available for {Array.isArray(device) ? device.join(', ') : device} - {Array.isArray(dataType) ? dataType.join(', ') : dataType}. Please select a different data type.</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="section-title">Export / Actions</div>
          <div className="control-row">
            <ExportCSVButton data={timeSeriesData} filename={IMEI + "_" + startDateTime.split(".")[0].replace("T", " ") + "_to_" + endDateTime.split(".")[0].replace("T", " ") + ".csv"} />
          </div>
        </div>
        {auth.user?.profile.email === "natsense00@gmail.com" ? 
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="section-title">Refresh sdid and dsid</div>
          <button className="brand-button button-outline" onClick={Refresh}>Refresh</button>
          </div> 
        : <></>}
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: 24 }}>
      <div className="brand-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logoSrc} alt="Company Logo" style={{ height: '36px' }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/next.svg'; }} />
          <span className="brand-title">{brandTitle}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={theme} onChange={handleThemeChange} className="brand-select">
            <option value="theme-a">Theme A</option>
            <option value="theme-b">Theme B</option>
            <option value="theme-c">Theme C</option>
          </select>
          <select value={mode} onChange={handleModeChange} className="brand-select">
            <option value="mode-light">Light</option>
            <option value="mode-dark">Dark</option>
          </select>
        </div>
      </div>

      <section className="hero">
        <h1 className="hero-title">{brandTitle}</h1>
        <div className="hero-actions"> 
        <img src={'/companyPhoto/RHT2.avif'} alt="Company Logo" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/next.svg'; }} />
        <img src={'/companyPhoto/RHT1.avif'} alt="Company Logo" style={{ height: '400px' }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/next.svg'; }} />
        </div>
        <p className="hero-subtitle">Sign in to view dashboards, filter data, and export CSV.</p>
        <div className="hero-actions"> 
          <button className="brand-button" onClick={() => auth.signinRedirect()}>Sign in</button>
        </div>
      </section>
    </div>
  );
}

export default App;
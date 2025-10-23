"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "react-oidc-context";
import Form from 'react-bootstrap/Form';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, ArcElement } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { LatestDashboard } from "../components/DashboardGauges";
import { getIMEIList, getLatestDP, getDPFromTime, createLatestDpPoller } from "../lib/aws";
import 'chartjs-adapter-date-fns';
import DateTimeRangePickerValue from "../datepicker";
import dayjs from "dayjs";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, ArcElement);

// Center text plugin is provided by shared DashboardGauges; local plugin removed.

function SelectIMEIDev({ IMEI , setValue, setcurrdev, setdevarr}) {
  const handleSelect=(e)=>{
    if(e.target.value){
      setValue(e.target.value)
      setcurrdev([]);
      setdevarr([]);
    }
  }
  return (
    <Form.Select className="brand-select" aria-label="Default select example" onChange={handleSelect}>
      <option value="">Choose location</option>
       {IMEI.map((opt, index) => {
          const label = typeof opt === 'string' ? opt : (opt?.Location ?? String(opt?.DeviceID ?? ''));
          const value = typeof opt === 'string' ? opt : String(opt?.DeviceID ?? '');
          return (
            <option key={index} value={value}>
              {label}
            </option>
          );
        })}
    </Form.Select>
  );
}

function DropboxDev({ devicearr, setcurrdev, allowed }: { devicearr: any; setcurrdev: (v: string[]) => void; allowed?: string[] }) {
  if(!devicearr){
    return (<p>click refresh</p>);
  }
  const handleMultiSelect=(e)=>{
    const selectedKeys = Array.from(e.target.selectedOptions).map(opt => opt.value);
    const values = selectedKeys.map(key => Array.isArray(devicearr) ? devicearr[key] : devicearr[key]);
    setcurrdev(values);
  };
  const allowedSet = new Set(allowed || []);
  const entries = Array.isArray(devicearr)
    ? devicearr.map((val, idx) => [String(idx), val])
    : Object.entries(devicearr);
  const filteredEntries = entries.filter(([key, value]) => allowedSet.size === 0 ? true : allowedSet.has(String(value)));
  return (
    <Form.Select multiple size={Math.min(filteredEntries.length, 6)} className="brand-select" aria-label="Select devices" onChange={handleMultiSelect}>
      {filteredEntries.map(([key, value]) => (
        <option key={key} value={key}>
          {value}
        </option>
      ))}
    </Form.Select>
  );
}
function DropboxTime({setValue}) {
  const handleSelect=(e)=>{
    if(e.target.value){
      setValue(e.target.value)
    }
  }
  return (
    <Form.Select className="brand-select" aria-label="Default select example" onChange={handleSelect}>
      <option>Choose Time Interval</option>
      <option value="1min">1 min</option>
      <option value="5min">5 min</option>
      <option value="15min">15 min</option>
      <option value="1hr">1 hours</option>
      <option value="1day">1 day</option>
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

// Using shared gauges now; removed inline GaugeCard and LatestDashboard.

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

function LoginApp() {
  const auth = useAuth();
  const [userInfo, setUserInfo] = useState({ username: "" , name: ""});
  const [IMEI_ARR, setIMEI_ARR] = useState([]);
  const [IMEI,setIMEI]=useState('');
  const [deviceMap, setDeviceMap]=useState('');
  const [timeInterval, setTimeInterval]=useState('');
  const [deviceType, setDeviceType]=useState('');
  const [device, setDevice]=useState<string[]>([]);
  const [startDateTime, setStartDateTime]=useState('');
  const [endDateTime, setEndDateTime]=useState('');
  const [dataType, setDataType] = useState<string[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [allowedByDeviceId, setAllowedByDeviceId] = useState<Record<string, string[]>>({});
  const [allowedDeviceTypes, setAllowedDeviceTypes] = useState<string[]>([]);
  const pollerRef = useRef<any>(null);

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
        setUserInfo(data);
      }
    };

    fetchUserInfo();

    const callApi = async (email) => {
      if(auth.isAuthenticated && email){
        try {
          const list = await getIMEIList(email, auth.user?.id_token as string);
          const items = Array.isArray(list.items) ? list.items : [];
          setIMEI_ARR(items);
          const access = Array.isArray(list.dev_access) ? list.dev_access : [];
          const map: Record<string, string[]> = {};
          items.forEach((it, idx) => {
            const devs = Array.isArray(access[idx]) ? access[idx].map(String) : [];
            map[String(it.DeviceID)] = devs;
          });
          setAllowedByDeviceId(map);
          // Initialize allowed list for current IMEI if available
          if (IMEI) setAllowedDeviceTypes(map[String(IMEI)] || []);
        } catch (err) {
          console.error("getIMEIList error:", err);
        }
      };
    }
    callApi(auth.user?.profile.email);
  }, [auth.isAuthenticated, auth.user?.access_token,auth.user?.profile.email,auth.user?.id_token]);

  // Update allowed device types when IMEI changes
  useEffect(() => {
    if (!IMEI) { setAllowedDeviceTypes([]); return; }
    setAllowedDeviceTypes(allowedByDeviceId[String(IMEI)] || []);
  }, [IMEI, allowedByDeviceId]);
  
  const getLatestDp = async () => {
    if (!IMEI || !auth.user?.id_token) return;
    try {
      const result = await getLatestDP(IMEI, auth.user.id_token);
      setDeviceMap(result.deviceMap as any);
      setDeviceType(result.deviceTypes as any);
      setLastRefresh(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch (err) {
      console.error("getLatestDP error:", err);
    }
  };

  const getDpfromtime = async () => {
    if (!IMEI || !auth.user?.id_token) return;
    try {
      const data = await getDPFromTime(IMEI, startDateTime, endDateTime, auth.user.id_token, timeInterval);
      setDeviceType(data.deviceTypes || []);
      setTimeSeriesData(data.items || []);
    } catch (err) {
      console.error("getDPFromTime error:", err);
    }
  };

  // Manual auto-refresh: start only when user clicks "Get New Data"
  const startAutoRefresh = async () => {
    if (!auth.isAuthenticated || !IMEI || !auth.user?.id_token) return;
    if (pollerRef.current) {
      try { pollerRef.current.stop(); } catch {}
      pollerRef.current = null;
    }
    const poller = createLatestDpPoller({
      IMEI,
      idToken: auth.user.id_token,
      intervalMs: 5 * 60 * 1000,
      callback: (result) => {
        setDeviceMap(result.deviceMap as any);
        setDeviceType(result.deviceTypes as any);
        setLastRefresh(dayjs().format('YYYY-MM-DD HH:mm:ss'));
      },
    });
    pollerRef.current = poller;
    await poller.start();
  };

  const stopAutoRefresh = () => {
    if (pollerRef.current) {
      try { pollerRef.current.stop(); } catch {}
      pollerRef.current = null;
    }
  };

  // Clear existing interval when IMEI changes or on unmount
  useEffect(() => {
    stopAutoRefresh();
    return () => stopAutoRefresh();
  }, [IMEI]);

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





  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="page-container" style={{ paddingTop: 24 }}>
        <div className="panel">
          <div className="section-title">Not signed in</div>
          <p>Please go to the home page and click Sign in.</p>
          <a href="/" className="brand-button">Go to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Theme header with logo and switcher */}
      <div className="brand-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logoSrc} alt="Company Logo" style={{ height: '36px' }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/next.svg'; }} />
          <span className="brand-title">{brandTitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={mode} onChange={handleModeChange} className="brand-select">
            <option value="mode-light">Light</option>
            <option value="mode-dark">Dark</option>
          </select>
          <button className="brand-button button-outline" onClick={() => signOutRedirect()}>Sign out</button>            
          { auth.user?.profile.email === "natsense00@gmail.com" ? <button className="brand-button button-outline" onClick={() => window.location.replace('/admin')}>admin</button> :<></>}           
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
            <SelectIMEIDev IMEI={IMEI_ARR} setValue={setIMEI} setcurrdev={setDevice} setdevarr={setDeviceType} />
          </div>
          <p>Device:</p>
          <div className="control-row">
          <DropboxDev devicearr={deviceType} setcurrdev={setDevice} allowed={allowedDeviceTypes} />
          </div>
          <p>Datatype:</p>
          <div className="control-row">
            <DataTypeDropdown timeSeriesData={timeSeriesData} device={device} dataType={dataType} setDataType={setDataType} />
          </div>
          
          <p>Average Interval:</p>
          <div className="control-row">
            <DropboxTime setValue = {setTimeInterval}/>
          </div>
          <div className="control-row">
            <DateTimeRangePickerValue setStartDateTime={setStartDateTime} setEndDateTime={setEndDateTime} />
          </div>
          <div className="control-row">
            <button className="brand-button" onClick={() => { getLatestDp(); startAutoRefresh(); }} style={{ marginRight: 8 }}>Get New Data</button>
            <button className="brand-button button-secondary" onClick={getDpfromtime}>Load Range</button>
          </div>
        </div>

        <div className="panel">
          <div className="section-title">Latest Data Dashboard</div>
          <div style={{ marginTop: 4, marginBottom: 8, opacity: 0.7, fontSize: 12 }}>
            Last call: {lastRefresh || '-'}
          </div>
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

      {/* Bottom actions */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">View in 3D</div>
        <div className="control-row">
          <a className="brand-button button-secondary" href="/3d" style={{ marginLeft: 8 }}>View 3D Model</a>
        </div>
      </div>
      
          
    </div>
  );
}

export default LoginApp;
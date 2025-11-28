"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "react-oidc-context";
import Form from 'react-bootstrap/Form';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, TimeSeriesScale, ArcElement, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { asset } from "../lib/asset";
import { LatestDashboard } from "../components/DashboardGauges";
import { getIMEIList, getLatestDP, getDPFromTime } from "../lib/aws";
import 'chartjs-adapter-date-fns';
import DateTimeRangePickerValue from "../datepicker";
import dayjs from "dayjs";

import Image from 'next/image';
import { getOidcConfig, buildLogoutUrl } from "../authConfig";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, TimeSeriesScale, ArcElement);

// Center text plugin is provided by shared DashboardGauges; local plugin removed.

function SelectIMEIMulti({ IMEI, setValues, setcurrdev, setdevarr }) {
  const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setValues(selected);
    setcurrdev([]);
    setdevarr([]);
  };
  const entries = Array.isArray(IMEI) ? IMEI : [];
  return (
    <Form.Select multiple className="brand-select" aria-label="Select IMEIs" onChange={handleMultiSelect}>
      {entries.map((opt, index) => {
        const label = typeof opt === 'string' ? opt : (opt?.Location ?? String(opt?.DeviceID ?? ''));
        const value = typeof opt === 'string' ? opt : String(opt?.DeviceID ?? '');
        return (
          <option key={index} value={value}>
            {label} ({value})
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
  const handleMultiSelect=(e: React.ChangeEvent<HTMLSelectElement>)=>{
    const selectedKeys = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    const values = selectedKeys.map(key => Array.isArray(devicearr) ? devicearr[key] : devicearr[key]);
    setcurrdev(values);
  };
  const allowedSet = new Set(allowed || []);
  const entries = Array.isArray(devicearr)
    ? devicearr.map((val, idx) => [String(idx), val])
    : Object.entries(devicearr);
  const filteredEntries = entries.filter(([key, value]) => allowedSet.size === 0 ? true : allowedSet.has(String(value)));
  return (
    <Form.Select multiple className="brand-select" aria-label="Select devices" onChange={handleMultiSelect}>
      {filteredEntries.map(([key, value]) => (
        <option key={key} value={key}>
          {value}
        </option>
      ))}
    </Form.Select>
  );
}
function DropboxTime({setValue}) {
  const handleSelect=(e: React.ChangeEvent<HTMLSelectElement>)=>{
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

function DataTypeDropdown({ timeSeriesData, device, dataType, setDataType }: { timeSeriesData: any[]; device: string[]; dataType: string[]; setDataType: (v: string[]) => void }) {
  if (!timeSeriesData || timeSeriesData.length === 0 || !device || device.length === 0) {
    return <p>Select device(s) first</p>;
  }

  const meta = new Set(["DeviceID", "DeviceType", "Timestamp"]);
  const deviceItems = timeSeriesData.filter(i => device.includes(i.DeviceType));
  const dataFields: string[] = Array.from(new Set(
    deviceItems.flatMap(i => Object.keys(i).filter(k => !meta.has(k) && typeof (i as Record<string, any>)[k] === 'number'))
  )) as string[];

  if (dataFields.length === 0) {
    return <p>No numeric data available</p>;
  }

  const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setDataType(selected);
  };

  return (
    <Form.Select multiple className="brand-select" aria-label="Select data types" value={dataType} onChange={handleMultiSelect}>
      {dataFields.map(field => (
        <option key={field} value={field}>
          {field}
        </option>
      ))}
    </Form.Select>
  );
}

// Using shared gauges now; removed inline GaugeCard and LatestDashboard.

const ExportCSVButton = ({ data, filename = "export.csv" }: { data: Array<Record<string, any>>; filename?: string }) => {
  const convertToCSV = (arr: Array<Record<string, any>>) => {
    if (!arr || arr.length === 0) return "";
    // Define the order you want
    const fixedOrder = ["DeviceID", "Timestamp", "DeviceType"];

    // Collect all other keys dynamically (excluding the fixed ones)
    const otherKeysSet = new Set<string>();
    for (const obj of arr) {
      for (const k of Object.keys(obj)) {
        if (!fixedOrder.includes(k)) otherKeysSet.add(k);
      }
    }
    const otherKeys = Array.from(otherKeysSet);

    // Final header order
    const keys = [...fixedOrder, ...otherKeys];

    // Header row
    const header = keys.join(",") + "\n";

    // Data rows
    const rows = arr
      .map((obj: Record<string, any>) =>
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
  const [IMEIs, setIMEIs] = useState<string[]>([]);
  const [deviceMap, setDeviceMap]=useState('');
  const [timeInterval, setTimeInterval]=useState('');
  const [deviceType, setDeviceType]=useState<string[]>([]);
  const [device, setDevice]=useState<string[]>([]);
  const [startDateTime, setStartDateTime]=useState('');
  const [endDateTime, setEndDateTime]=useState('');
  const [dataType, setDataType] = useState<string[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [allowedByDeviceId, setAllowedByDeviceId] = useState<Record<string, string[]>>({});
  const [allowedDeviceTypes, setAllowedDeviceTypes] = useState<string[]>([]);
  const pollerRef = useRef<any>(null);
  const [selectedDevicesByImei, setSelectedDevicesByImei] = useState<Record<string, string[]>>({});

  // Theme state
  const [theme, setTheme] = useState<'theme-a' | 'theme-b' | 'theme-c'>('theme-b');
  const [logoSrc, setLogoSrc] = useState(asset('/logos/logo1.png'));
  const [mode, setMode] = useState<'mode-light' | 'mode-dark'>('mode-light');
  const [activeTab, setActiveTab] = useState<'latest' | 'history' | '3d' | 'control'>('latest');
  // Dynamic brand title per theme
  const brandTitle = theme === 'theme-a' ? 'RHT Limited' : theme === 'theme-b' ? 'CMA testing' : 'Natsense';

  // Add a body class to adjust global footer when sidebar is present
  useEffect(() => {
    document.body.classList.add('has-side-nav');
    return () => { document.body.classList.remove('has-side-nav'); };
  }, []);

  const options: ChartOptions<'line'> = {
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
        type: 'timeseries',
        time: {
          unit: 'minute'
        },
        title: {
          display: true,
          text: 'Timestamp'
        },
        
      },
      y: {
        type: 'linear',
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
    setLogoSrc(asset(`/logos/logo${logoIndex}.png`));

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
    setLogoSrc(asset(`/logos/logo${logoIndex}.png`));
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
          const getIdToken = async () => {
            try {
              const fn: any = (auth as any)?.signinSilent;
              if (typeof fn === 'function') {
                const user = await fn();
                const tk = (user as any)?.id_token;
                if (tk) return tk;
              }
            } catch {}
            return auth.user?.id_token as string;
          };
          const list = await getIMEIList(email, auth.user?.id_token as string, getIdToken);
          const items = Array.isArray(list.items) ? list.items : [];
          setIMEI_ARR(items);
          const access = Array.isArray(list.dev_access) ? list.dev_access : [];
          const map: Record<string, string[]> = {};
          items.forEach((it, idx) => {
            const devs = Array.isArray(access[idx]) ? access[idx].map(String) : [];
            map[String(it.DeviceID)] = devs;
          });
          setAllowedByDeviceId(map);
          // Initialize allowed list for current IMEIs if available
          if (IMEIs && IMEIs.length > 0) {
            const union = new Set<string>();
            IMEIs.forEach(id => (map[String(id)] || []).forEach(dt => union.add(dt)));
            setAllowedDeviceTypes(Array.from(union));
          }
        } catch (err) {
          console.error("getIMEIList error:", err);
        }
      };
    }
    callApi(auth.user?.profile.email);
  }, [auth.isAuthenticated, auth.user?.access_token,auth.user?.profile.email,auth.user?.id_token]);

  // Update allowed device types when IMEIs change
  useEffect(() => {
    if (!IMEIs || IMEIs.length === 0) { setAllowedDeviceTypes([]); return; }
    const union = new Set<string>();
    IMEIs.forEach(id => (allowedByDeviceId[String(id)] || []).forEach(dt => union.add(dt)));
    setAllowedDeviceTypes(Array.from(union));
  }, [IMEIs, allowedByDeviceId]);

  // Maintain per-IMEI device selections and compute union into `device`
  const handleDevicesForImei = (imei: string, values: string[]) => {
    setSelectedDevicesByImei(prev => {
      const next = { ...prev, [imei]: values };
      const union = Array.from(new Set(Object.values(next).flat())) as string[];
      setDevice(union);
      return next;
    });
  };

  // When IMEIs change, drop selections for removed IMEIs and recompute union
  useEffect(() => {
    setSelectedDevicesByImei(prev => {
      const next: Record<string, string[]> = {};
      IMEIs.forEach(id => { if (prev[id]) next[id] = prev[id]; });
      const union = Array.from(new Set(Object.values(next).flat())) as string[];
      setDevice(union);
      return next;
    });
  }, [IMEIs]);
  
  const getLatestDp = async () => {
    if (!IMEIs || IMEIs.length === 0 || !auth.user?.id_token) return;
    try {
      const getIdToken = async () => {
        try {
          const fn: any = (auth as any)?.signinSilent;
          if (typeof fn === 'function') {
            const user = await fn();
            const tk = (user as any)?.id_token;
            if (tk) return tk;
          }
        } catch {}
        return auth.user!.id_token as string;
      };
      const results = await Promise.all(IMEIs.map(imei => getLatestDP(imei, auth.user!.id_token as string, getIdToken)));
      const combinedMap: Record<string, any> = {};
      const devTypes = new Set<string>();
      results.forEach(res => {
        const devList = Array.isArray(res.deviceTypes) ? res.deviceTypes : Object.values(res.deviceTypes || {});
        devList.forEach(dt => devTypes.add(dt));
        Object.entries(res.deviceMap || {}).forEach(([dt, record]: any) => {
          const tsNew = record?.Timestamp || '';
          const tsOld = combinedMap[dt]?.Timestamp || '';
          if (!combinedMap[dt] || tsNew > tsOld) {
            combinedMap[dt] = record;
          }
        });
      });
      setDeviceMap(combinedMap as any);
      setDeviceType(Array.from(devTypes) as any);
      setLastRefresh(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch (err) {
      console.error("getLatestDP error:", err);
    }
  };

  const getDpfromtime = async () => {
    if (!IMEIs || IMEIs.length === 0 || !auth.user?.id_token) return;
    try {
      const results = await Promise.all(
        IMEIs.map(imei => getDPFromTime(imei, startDateTime, endDateTime, auth.user!.id_token as string, timeInterval))
      );
      const devTypes = new Set<string>();
      const itemsAll: any[] = [];
      results.forEach(r => {
        (r.deviceTypes || []).forEach(dt => devTypes.add(dt));
        itemsAll.push(...(r.items || []));
      });
      setDeviceType(Array.from(devTypes));
      setTimeSeriesData(itemsAll);
    } catch (err) {
      console.error("getDPFromTime error:", err);
    }
  };

  // Manual auto-refresh: start only when user clicks "Get New Data"
  const startAutoRefresh = async () => {
    if (!auth.isAuthenticated || !IMEIs || IMEIs.length === 0 || !auth.user?.id_token) return;
    if (pollerRef.current) {
      try { window.clearInterval(pollerRef.current as any); } catch {}
      pollerRef.current = null;
    }
    await getLatestDp();
    const timer = window.setInterval(() => { getLatestDp(); }, 5 * 60 * 1000);
    pollerRef.current = timer;
  };

  const stopAutoRefresh = () => {
    if (pollerRef.current) {
      try { window.clearInterval(pollerRef.current as any); } catch {}
      pollerRef.current = null;
    }
  };

  // Clear existing interval when IMEI changes or on unmount
  useEffect(() => {
    stopAutoRefresh();
    return () => stopAutoRefresh();
  }, [IMEIs]);

  // Build chart data: separate lines per IMEI + device + data type
  const prepareChartData = () => {
    if (!IMEIs || IMEIs.length === 0 || !device || device.length === 0 || !dataType || dataType.length === 0 || timeSeriesData.length === 0) {
      return { datasets: [] };
    }
    const colors = ['#36a2eb', '#ff6384', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf', '#2ecc71', '#c0392b'];
    const datasets: any[] = [];
    IMEIs.forEach((imei, ii) => {
      device.forEach((dev, di) => {
        dataType.forEach((dt, ti) => {
          const deviceData = timeSeriesData.filter(item => String(item.DeviceID) === String(imei) && item.DeviceType === dev);
          const points = deviceData
            .filter(item => typeof item[dt] === 'number')
            .map(item => ({ x: item.Timestamp.split('.')[0].replace('T', ' '), y: item[dt] }));
          if (points.length > 0) {
            const color = colors[(ii * device.length * dataType.length + di * dataType.length + ti) % colors.length];
            datasets.push({
              label: `${dev} • ${dt} • IMEI ${imei}`,
              data: points,
              borderColor: color,
              backgroundColor: 'transparent',
              tension: 0.1,
            });
          }
        });
      });
    });
    return { datasets };
  };

  const chartData = prepareChartData();

  const signOutRedirect = () => {
    const config = getOidcConfig();
    try { (auth as any)?.removeUser?.(); } catch {}
    const url = buildLogoutUrl(config);
    if (url) {
      window.location.href = url;
    } else {
      // Fallback: clear user and reload root
      window.location.href = '/';
    }
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
          <a href={asset("/")} className="brand-button">Go to Home</a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed top navigation with brand header */}
      <header className="top-nav brand-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src={logoSrc} alt="Company Logo" width={36} height={36} onError={(e) => { (e.currentTarget as HTMLImageElement).src = asset('/next.svg'); }} />
          <span className="brand-title">{brandTitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={mode} onChange={handleModeChange} className="brand-select">
            <option value="mode-light">Light</option>
            <option value="mode-dark">Dark</option>
          </select>
          <button className="brand-button button-outline" onClick={() => signOutRedirect()}>Sign out</button>            
          { auth.user?.profile.email === "natsense00@gmail.com" ? <button className="brand-button button-outline" onClick={() => window.location.replace(asset("/admin"))}>admin</button> :<></>}           
        </div>
      </header>
      {/* Fixed left navigation bar */}
      <nav className="side-nav">
        <button className={`brand-button ${activeTab === 'latest' ? 'is-active' : ''}`} onClick={() => setActiveTab('latest')}>
          <Image src={asset('/dashboard.png')} alt="Latest" width={36} height={36}/>
          <span className="nav-label">Latest Data</span>
        </button>
        <button className={`brand-button ${activeTab === 'history' ? 'is-active' : ''}`} onClick={() => setActiveTab('history')}>
          <Image src={asset('/chart.png')} alt="History" width={36} height={36}/>
          <span className="nav-label">History Data</span>
        </button>
        <a className="brand-button" href={asset('/3d')}>
          <Image src={asset('/3d.png')} alt="3D" width={36} height={36}/>
          <span className="nav-label">3D Mode</span>
        </a>
        <a className="brand-button" href={asset('/controlPanel')}>
          <Image src={asset('/ControlPanel.png')} alt="Control" width={36} height={36}/>
          <span className="nav-label">Control Panel</span>
        </a>
      </nav>

      <div className="content-shell">
        <div className="page-container">
      {/* (brand header moved to fixed top navigation) */}
      {/* Friendly hint */}
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="section-title">Welcome, {userInfo.username || 'User'}</div>
        <p style={{ margin: 0, opacity: 0.9 }}>Use the left menu to switch between Latest datapoint, History data, 3D mode, and Control Panel.</p>
      </div>

      {/* Right content area */}
      <div style={{ marginTop: 12 }}>
          {activeTab === 'latest' && (
            <>
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <div className="panel">
                  <div className="section-title">Filters</div>
                  <p>IMEIs:</p>
                  <div className="control-row">
                    <SelectIMEIMulti IMEI={IMEI_ARR} setValues={setIMEIs} setcurrdev={setDevice} setdevarr={setDeviceType} />
                  </div>
                  {IMEIs && IMEIs.length > 0 && (
                    <>
                      <p>Devices per IMEI:</p>
                      {IMEIs.map((id) => {
                        const allowed = allowedByDeviceId[String(id)] || [];
                        const label = (() => {
                          const item = IMEI_ARR.find((it: any) => String(it?.DeviceID ?? '') === String(id));
                          return item?.Location ? `${item.Location} (${String(id)})` : String(id);
                        })();
                        return (
                          <div key={id} className="control-row">
                            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>IMEI: {label}</div>
                            <DropboxDev
                              devicearr={deviceType}
                              allowed={allowed}
                              setcurrdev={(values: string[]) => handleDevicesForImei(String(id), values)}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}
                  <p>Datatype:</p>
                  <div className="control-row">
                    <DataTypeDropdown timeSeriesData={timeSeriesData} device={device} dataType={dataType} setDataType={setDataType} />
                  </div>
                  <div className="control-row">
                    <button className="brand-button" onClick={() => { getLatestDp(); startAutoRefresh(); }} style={{ marginRight: 8 }}>Get New Data</button>
                    <button className="brand-button button-secondary" onClick={() => stopAutoRefresh()}>Stop Auto Refresh</button>
                  </div>
                </div>

                <div className="panel">
                  <div className="section-title">Latest Data Dashboard</div>
                  <div style={{ marginTop: 4, marginBottom: 8, opacity: 0.7, fontSize: 12 }}>
                    Last call: {lastRefresh || '-'}
                  </div>
                  <LatestDashboard deviceMap={deviceMap} device={device} dataType={dataType} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <>
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <div className="panel">
                  <div className="section-title">Filters</div>
                  <p>IMEIs:</p>
                  <div className="control-row">
                    <SelectIMEIMulti IMEI={IMEI_ARR} setValues={setIMEIs} setcurrdev={setDevice} setdevarr={setDeviceType} />
                  </div>
                  {IMEIs && IMEIs.length > 0 && (
                    <>
                      <p>Devices per IMEI:</p>
                      {IMEIs.map((id) => {
                        const allowed = allowedByDeviceId[String(id)] || [];
                        const label = (() => {
                          const item = IMEI_ARR.find((it: any) => String(it?.DeviceID ?? '') === String(id));
                          return item?.Location ? `${item.Location} (${String(id)})` : String(id);
                        })();
                        return (
                          <div key={id} className="control-row">
                            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>IMEI: {label}</div>
                            <DropboxDev
                              devicearr={deviceType}
                              allowed={allowed}
                              setcurrdev={(values: string[]) => handleDevicesForImei(String(id), values)}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}
                  <p>Datatype:</p>
                  <div className="control-row">
                    <DataTypeDropdown timeSeriesData={timeSeriesData} device={device} dataType={dataType} setDataType={setDataType} />
                  </div>
                  <p>Average Interval:</p>
                  <div className="control-row">
                    <DropboxTime setValue={setTimeInterval} />
                  </div>
                  <div className="control-row">
                    <DateTimeRangePickerValue setStartDateTime={setStartDateTime} setEndDateTime={setEndDateTime} />
                  </div>
                  <div className="control-row">
                    <button className="brand-button button-secondary" onClick={getDpfromtime}>Load Range</button>
                  </div>
                </div>

                <div className="panel">
                  <div className="section-title">History Chart</div>
                  {chartData.datasets.length > 0 && (
                    <div style={{ height: 500 }}>
                      <Line data={chartData} options={options} />
                    </div>
                  )}
                  {timeSeriesData.length > 0 && chartData.datasets.length === 0 && (
                    <div style={{ marginTop: '20px', color: 'orange' }}>
                      <p>No data available for {Array.isArray(device) ? device.join(', ') : device} - {Array.isArray(dataType) ? dataType.join(', ') : dataType}. Please select a different data type.</p>
                    </div>
                  )}
                  <div className="panel" style={{ marginTop: 16 }}>
                    <div className="section-title">Export CSV</div>
                    <div className="control-row">
                      <ExportCSVButton data={timeSeriesData} filename={(IMEIs && IMEIs.length ? IMEIs.join('-') : 'IMEI') + "_" + startDateTime.split('.')[0].replace('T', ' ') + "_to_" + endDateTime.split('.')[0].replace('T', ' ') + ".csv"} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
      </div>
      </div>
      {/* Close content shell */}
      </div>
    </>
  );
}

export default LoginApp;

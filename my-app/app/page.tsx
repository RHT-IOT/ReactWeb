// App.js
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import Form from 'react-bootstrap/Form';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import DateTimeRangePickerValue from "./datepicker";
import dayjs from "dayjs";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);
function SelectBasicExample({ IMEI , setValue, setcurrdev, setdevarr}) {
  const handleSelect=(e)=>{
    if(e.target.value){
      console.log(e.target.value);
      setValue(e.target.value)
      setcurrdev("");
      setdevarr("");
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

  return (
    <p>click refresh</p>
  );
  }
  const handleSelect=(e)=>{
    if(e.target.value){
      console.log(e.target.value);
      console.log("set dev:", devicearr[e.target.value]);
      setcurrdev(devicearr[e.target.value]);
    }
  }
  return (
    
    <Form.Select className="brand-select" aria-label="Default select example" onChange={handleSelect}>
      <option value="">Choose your Device</option>
      {Object.entries(devicearr).map(([key, value]) => (
        <option key={key} value={key}>
          {value}
        </option>
      ))}
    </Form.Select>
  );
}

function DataTypeDropdown({ timeSeriesData, device, dataType, setDataType }) {
  if (!timeSeriesData || timeSeriesData.length === 0 || !device) {
    return <p>Select a device first</p>;
  }

  const meta = new Set(["DeviceID", "DeviceType", "Timestamp"]);
  const deviceItems = timeSeriesData.filter(i => i.DeviceType === device);
  const dataFields = Array.from(new Set(
    deviceItems.flatMap(i => Object.keys(i).filter(k => !meta.has(k) && typeof i[k] === 'number'))
  ));

  if (dataFields.length === 0) {
    return <p>No numeric data available</p>;
  }

  const handleSelect = (e) => {
    setDataType(e.target.value);
  };

  return (
    <Form.Select className="brand-select" aria-label="Select data type" value={dataType} onChange={handleSelect}>
      <option value="">Select Data Type</option>
      {dataFields.map(field => (
        <option key={field} value={field}>
          {field}
        </option>
      ))}
    </Form.Select>
  );
}

function Table_disp({deviceMap, device}){
  if(!deviceMap || !device){
    return(
        <pre> No data Yet </pre>
    );
  }
  const timestamp = deviceMap[device]["Timestamp"].split(".")[0].replace("T", " ");
  return(<table border="1" style={{ borderCollapse: "collapse", width: "60%" }}>
    <thead>
      <tr>
        <th>Variable</th>
        <th>Value</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody>
      
      {Object.entries(deviceMap[device]).filter(([key]) => (key !== "Timestamp")).filter(([key]) => (key !== "DeviceID")).filter(([key]) => (key !== "DeviceType")).map(([key, value]) => (
        <tr key={key}>
          <td>{key}</td>
          <td>{String(value)}</td>
          <td>{timestamp}</td>
        </tr>
      ))}
       
    </tbody>
  </table>);
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
  const [device, setDevice]=useState('');
  const [startDateTime, setStartDateTime]=useState('');
  const [endDateTime, setEndDateTime]=useState('');
  const [dataType, setDataType] = useState('');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  // Theme state
  const [theme, setTheme] = useState<'theme-a' | 'theme-b' | 'theme-c'>('theme-a');
  const [logoSrc, setLogoSrc] = useState('/logos/logo1.png');
  const [mode, setMode] = useState<'mode-light' | 'mode-dark'>('mode-light');
  // Dynamic brand title per theme
  const brandTitle = theme === 'theme-a' ? 'RHT Limited' : theme === 'theme-b' ? 'CMA testing' : 'Natsense';
const options = {
  responsive: true,
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
        text: dataType || 'Value'
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
    if (!device || !dataType || timeSeriesData.length === 0) {
      return { datasets: [] };
    }
    const deviceData = timeSeriesData.filter(item => item.DeviceType === device);
    const points = deviceData
      .filter(item => typeof item[dataType] === 'number')
      .map(item => ({ x: item.Timestamp.split(".")[0].replace("T", " "), y: item[dataType] }));
    console.log("points:",points);
    return {
      datasets: [
        {
          label: `${device} - ${dataType}`,
          data: points,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }
      ]
    };
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
            <select value={theme} onChange={handleThemeChange} className="brand-select">
              <option value="theme-a">Theme A</option>
              <option value="theme-b">Theme B</option>
              <option value="theme-c">Theme C</option>
            </select>
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
              <button className="brand-button" onClick={getLatestDp} style={{ marginRight: 8 }}>Refresh</button>
              <button className="brand-button button-secondary" onClick={getDpfromtime}>Load Range</button>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">Data and Preview</div>
            <Table_disp deviceMap={deviceMap} device={device} />
            {chartData.datasets.length > 0 && (
              <div className="panel" style={{ marginTop: '16px' }}>
                <h3>Time Series Chart: {device} - {dataType}</h3>
                <Line data={chartData} options={options} />
              </div>
            )}
            {timeSeriesData.length > 0 && chartData.datasets.length === 0 && (
              <div style={{ marginTop: '20px', color: 'orange' }}>
                <p>No data available for {device} - {dataType}. Please select a different data type.</p>
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
        <p className="hero-subtitle">Sign in to view dashboards, filter data, and export CSV.</p>
        <div className="hero-actions">
          <button className="brand-button" onClick={() => auth.signinRedirect()}>Sign in</button>
          <button className="brand-button button-outline" onClick={() => setTheme('theme-c')}>Try Theme C</button>
        </div>
      </section>
    </div>
  );
}

export default App;
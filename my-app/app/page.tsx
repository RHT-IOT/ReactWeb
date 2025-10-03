// App.js
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import Form from 'react-bootstrap/Form';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import DateTimeRangePickerValue from "./datepicker";
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
    <Form.Select aria-label="Default select example" onChange={handleSelect}>
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
    
    <Form.Select aria-label="Default select example" onChange={handleSelect}>
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
    <Form.Select aria-label="Select data type" value={dataType} onChange={handleSelect}>
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
      }
    },
    y: {
      title: {
        display: true,
        text: dataType || 'Value'
      }
    }
  }
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
      .map(item => ({ x: new Date(item.Timestamp), y: item[dataType] }));

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
    const logoutUri = "<logout uri>";
    const cognitoDomain = "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };
  https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }
  if (auth.isAuthenticated) {
    return (
      <div>
        <SelectBasicExample IMEI = {IMEI_ARR} setValue={setIMEI} setcurrdev = {setDevice} setdevarr = {setDeviceType}/>
        <DropboxDev devicearr = {deviceType} setcurrdev={setDevice}/>
        <DataTypeDropdown timeSeriesData={timeSeriesData} device={device} dataType={dataType} setDataType={setDataType} />
        <button onClick={getLatestDp}>Refresh</button>
        <button onClick={getDpfromtime}>manyDP</button>
        <pre>time{startDateTime}{endDateTime} </pre>
        <h1> Welcome {userInfo.username}!!</h1>
        {/* <pre> ID Token: {auth.user?.id_token} </pre>
        <pre> Access Token: {auth.user?.access_token} </pre>
        <pre> Refresh Token: {auth.user?.refresh_token} </pre> */}
        {/* <pre>{JSON.stringify(deviceMap[device], null, 2)}</pre> */}
        <Table_disp deviceMap = {deviceMap} device = {device}/>
        <button onClick={() => auth.removeUser()}>Sign out</button>
        <DateTimeRangePickerValue setStartDateTime={setStartDateTime} setEndDateTime={setEndDateTime}/>
        {chartData.datasets.length > 0 && (
          <div style={{ marginTop: '20px' }}>
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
    );
  }

  return (
    <div>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
      <button onClick={() => signOutRedirect()}>Sign out</button>
    </div>
  );
}

export default App;
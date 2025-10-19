"use client";

import { useAuth } from "react-oidc-context";
import { useEffect, useState,useId } from "react";
function ThreeTextBoxRow({values,setValues}) {

  const handleChange = (index, newValue) => {
    const updated = [...values];
    updated[index] = newValue;
    setValues(updated);
  };

  return (
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        border: "1px solid black",
      }}
    >
      <thead>
        <tr>
          <th style={{ border: "1px solid black", padding: "6px" }}>DeviceID</th>
          <th style={{ border: "1px solid black", padding: "6px" }}>Location</th>
          <th style={{ border: "1px solid black", padding: "6px" }}>Coordinate (lat, long)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          {values.map((val, idx) => (
            <td key={idx} style={{ border: "1px solid black", padding: "6px" }}>
              <textarea
                value={val}
                onChange={(e) => handleChange(idx, e.target.value)}
                rows={1}
                style={{
                  backgroundColor: "white",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  width: "100%",
                }}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
// Child component
function SensorBoxTable({ devices }) {


  if (!devices || devices.length === 0) {
    return <pre>No data yet</pre>;
  }

  return (
    <table
    style={{
      borderCollapse: "collapse",
      width: "100%",
      border: "1px solid black", // outer border
    }}
  >
    <thead>
      <tr>
        <th style={{ border: "1px solid black", padding: "6px" }}>DeviceID</th>
        <th style={{ border: "1px solid black", padding: "6px" }}>Location</th>
        <th style={{ border: "1px solid black", padding: "6px" }}>Coordinate</th>
      </tr>
    </thead>
    <tbody>
      {devices.map((d, idx) => (
        <tr key={idx}>
          <td style={{ border: "1px solid black", padding: "6px" }}>{d.DeviceID}</td>
          <td style={{ border: "1px solid black", padding: "6px" }}>{d.Location}</td>
          <td style={{ border: "1px solid black", padding: "6px" }}>
            {Array.isArray(d.Coordinate) ? d.Coordinate.join(", ") : d.Coordinate}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  );
}
  



// Parent component
export default function AdminPage() {
  const auth = useAuth();

  const[devices, setDevices] = useState();
  const [sensorBoxModel, setSensorBoxModel] = useState(["", "", ""]);

  const refresh_send = {
    Records: [{ eventName: "REFRESH" }]
  };

  const Refresh = () => {
    return fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/Refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      },
      body: JSON.stringify(refresh_send),
    });
  };
  const getDevList = async() =>{
    if (!auth?.user?.id_token) return;
  
    await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getSensorBoxModel", {
      method: "POST",
       headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user.id_token}`,
      }
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Raw API response:", data);
        const parsed = typeof data.body === "string" ? JSON.parse(data.body) : data.body;
        setDevices(parsed);
      })
      .catch((err) => console.error(err));
      return;

  }
  const AddNewIMEIDev = async () => {
    const newDevice = {
      DeviceID: Number(sensorBoxModel[0]), // convert to number if needed
      Location: sensorBoxModel[1],
      Coordinate: sensorBoxModel[2]
        .split(", ") // assume user types "22.21,113.54"
        .map((c) => parseFloat(c.trim())),
    };
    console.log(newDevice);
    return await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/putSensorBoxModel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      },
      body: JSON.stringify(newDevice),
    });
  };
  useEffect(() => {
    if (auth.isAuthenticated) {
      if (auth.user?.profile.email === "natsense00@gmail.com") {
        console.log("correct user");
        getDevList();
      } else {
        console.log("not ok");
      }
    }
  }, [auth.isAuthenticated, auth.user?.profile.email]);
  const [firstName, setFirstName] = useState('');

  return (

    <div className="page-container" style={{ paddingTop: 24 }}>
      <div
        className="brand-header"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
        }}
      >
        <span className="brand-title">Admin</span>
        <button
          className="brand-button button-outline"
          style={{ marginLeft: "auto" }}   // 👈 pushes button to the right
          onClick={() => window.location.replace("/login")}
        >
          Back to Dashboard
        </button>
      </div>
    
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">Refresh sdid and dsid</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="brand-button button-outline" onClick={Refresh}>Refresh</button>
        </div>      
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: 16 }}>
      <div className="panel" style={{flex: 1}}>
        <div className="section-title">SensorBoxTable</div>
        <SensorBoxTable devices={devices} />
      </div>
      <div className="panel" style={{ flex: 1 , gap: 8 }}>
          <div className="section-title">Latest Data Dashboard</div>
          <ThreeTextBoxRow values = {sensorBoxModel} setValues = {setSensorBoxModel}/>
          <button className="brand-button button-outline" onClick={async() => {await AddNewIMEIDev();await getDevList();}} style={{marginTop: 16}}>Add New IMEI Dev</button>
        </div>
      </div>
      
    </div>
  );
}

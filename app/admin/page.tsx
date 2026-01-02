"use client";

import { useAuth } from "react-oidc-context";
import { useEffect, useState,useId } from "react";
import { asset } from "../lib/asset";

// Cast to any to extend BigInt prototype for JSON serialization
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};
function AccessManager({ data, onSave }) {
  if (!data) {
    return <div>Loading…</div>;
  }
  const { email, Location, DevList } = data;

  // State: which email has which selections
  const [access, setAccess] = useState(
    email.reduce((acc, e) => {
      acc[e] = {}; // each email has a map of location -> selected devices
      return acc;
    }, {})
  );

  const toggleDevice = (user, loc, device) => {
    setAccess(prev => {
      const userAccess = { ...prev[user] };
      const locAccess = new Set(userAccess[loc] || []);
      if (locAccess.has(device)) {
        locAccess.delete(device);
      } else {
        locAccess.add(device);
      }
      userAccess[loc] = Array.from(locAccess);
      return { ...prev, [user]: userAccess };
    });
  };

  // Select all devices for a given user/location
  const selectAllForLocation = (user, loc, devices) => {
    setAccess(prev => {
      const userAccess = { ...prev[user] };
      const current = new Set(userAccess[loc] || []);
      for (const d of devices) current.add(d);
      userAccess[loc] = Array.from(current);
      return { ...prev, [user]: userAccess };
    });
  };

  // Clear all devices for a given user/location
  const clearAllForLocation = (user, loc) => {
    const prev = access;
    const userAccess = { ...prev[user] };
    userAccess[loc] = [];
    // delete userAccess[user][loc];
    const next = { ...prev, [user]: userAccess };
    delete next[user][loc];
    setAccess(next);
    if (onSave) {
      onSave(next);
    } else {
      console.log("Access cleared and saved:", next);
    }
  };

  const handleSave = () => {
    // Call the parent function with the current access state
    if (onSave) {
      onSave(access);
    } else {
      console.log("Access state:", access);
    }
  };

  return (
    <div>
    <div style={{ display: "flex", gap: "24px" }}>
     
      {email.map(user => (
        <div key={user} style={{ border: "1px solid #ccc", padding: 12 }}>
          <h3>{user}</h3>
          {Location.map((loc, idx) => (
            <div key={loc} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{loc}</strong>
                <button
                  className="brand-button button-outline"
                  style={{ padding: "2px 6px", fontSize: 12 }}
                  onClick={() => selectAllForLocation(user, loc, DevList[idx] || [])}
                  disabled={false}
                >
                  Select All
                </button>
                <button
                  className="brand-button button-outline"
                  style={{ padding: "2px 6px", fontSize: 12 }}
                  onClick={() => clearAllForLocation(user, loc)}
                >
                  Clear
                </button>
              </div>
              <div style={{ marginLeft: 12 }}>
                {DevList[idx].length === 0 ? (
                  <em>No devices</em>
                ) : (
                  DevList[idx].map(dev => (
                    <label key={dev} style={{ display: "block" }}>
                      <input
                        type="checkbox"
                        checked={access[user][loc]?.includes(dev) || false}
                        onChange={() => toggleDevice(user, loc, dev)}
                      />
                      {dev}
                    </label>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
      <pre style={{ flex: 1, background: "#f9f9f9", padding: 12 }}>
        {JSON.stringify(access, null, 2)}
      </pre>

        
    </div>
    <button className="brand-button button-outline"  onClick={handleSave} style={{ marginTop: 16 }}>
        Save Access
      </button>
    </div>
    
  );
}
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
  const[userDev, setUserDev] = useState();
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
  const GetDevUser = async() => {
     await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/showUserDevice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      }
    })
    .then((res) => res.json())
    .then((data) => {
      console.log("Raw API response:", data);
      const parsed = typeof data.body === "string" ? JSON.parse(data.body) : data.body;
      setUserDev(parsed);
    })
    .catch((err) => console.error(err));
    return;
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
  const addDevUser = async (access) => {
    // Transform nested access map into array of records
    // [{ email, Location, DeviceRight: [...] }, ...]
    const payload = [];
    for (const user of Object.keys(access || {})) {
      const locMap = access[user] || {};
      for (const loc of Object.keys(locMap)) {
        const rights = locMap[loc] || [];
        // Skip empty rights: clearing deletes the association, don't include empties
        if (rights.length > 0) {
          payload.push({ email: user, Location: loc, DeviceRight: rights });
        }
      }
    }
    console.log("AddDevUser:",payload);
    try {
      return await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/PutUserDevice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth.user.id_token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to save user device rights:", err);
    }
  };
  const AddNewIMEIDev = async () => {
    const newDevice = {
      DeviceID: BigInt(sensorBoxModel[0]), // convert to number if needed
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
        GetDevUser();
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
          onClick={() => window.location.replace(asset("/login"))}
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
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">Refresh DevUser</div>
        <button className="brand-button button-outline" onClick={GetDevUser}>Refresh</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <AccessManager data = {userDev} onSave = {addDevUser}/>
        {/* {userDev && (
          <div>
            <p>Email: {userDev.email}</p>
            <p>Location: {userDev.Location}</p>
            <p>Devices: {userDev.DevList.join(", ")}</p>
          </div>
        )} */}

        </div>      
      </div>
    </div>
  );
}

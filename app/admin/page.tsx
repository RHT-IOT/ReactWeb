"use client";

import { useAuth } from "react-oidc-context";
import { useEffect, useState } from "react";
import { asset } from "../lib/asset";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const AWS_MICROSOFT_LOGIN_URL = "https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/microsoft_login";
const AWS_MS_TOKEN_URL = "https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/ms_token";
const AWS_DIFY_TRIG_URL = "https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/dify_trig";

function getApiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : `${BASE_PATH}${path}`;
}

async function parseApiResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      "Backend returned non-JSON response."
    );
  }
}

// Request a device code via POST; open verification page in a new tab and return message/device_code
async function redirectToMicrosoftSignIn(tenant, clientId, awsAccessToken, onMessage, onDeviceCode) {
  if (!awsAccessToken) {
    if (typeof onMessage === "function") {
      onMessage("AWS access token is missing. Please sign in first.");
    }
    return;
  }

  try {
    const res = await fetch(AWS_MICROSOFT_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${awsAccessToken}`,
      }
    });
    const json = await parseApiResponse(res);

    let payload = json;
    if (typeof json?.body === "string") {
      try {
        payload = JSON.parse(json.body);
      } catch {
        payload = json;
      }
    } else if (json?.body && typeof json.body === "object") {
      payload = json.body;
    }

    if (!res.ok) {
      throw new Error(
        payload?.error_description ||
          payload?.error?.message ||
          json?.error_description ||
          "Device code request failed"
      );
    }

    const message = payload?.message;
    if (message && typeof onMessage === "function") {
      onMessage(message);
    }

    const deviceCode = payload?.device_code;
    if (deviceCode && typeof onDeviceCode === "function") {
      onDeviceCode(deviceCode);
    }

    const target = payload?.verification_uri_complete || payload?.verification_uri;
    if (target) {
      window.open(target, "_blank", "noopener,noreferrer");
    } else {
      console.log("Device code response:", payload);
    }
  } catch (err) {
    if (typeof onMessage === "function") {
      onMessage(err instanceof Error ? err.message : "Device code request failed");
    }
    console.error("Device code request failed:", err);
  }
}
// Cast to any to extend BigInt prototype for JSON serialization
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};
function AccessManager({ data, onSave }) {
  if (!data) {
    return <div>Loading…</div>;
  }
  const { email, Location, DevList, CurrDevAccess } = data;

  // State: which email has which selections
  const [access, setAccess] = useState(
    email.reduce((acc, e, idx) => {
      acc[e] = {}; // each email has a map of location -> selected devices
      if (CurrDevAccess && CurrDevAccess[idx]) {
        const userAccess = CurrDevAccess[idx];
        if (userAccess.Location && userAccess.DevList) {
          userAccess.Location.forEach((loc, locIdx) => {
            acc[e][loc] = userAccess.DevList[locIdx] || [];
          });
        }
      }
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
                <span
                  style={{
                    fontWeight: access[user][loc] !== undefined ? "bold" : "normal",
                    textDecoration: access[user][loc] !== undefined ? "underline" : "none",
                  }}
                >
                  {loc}
                </span>
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
  const awsAccessToken = auth.user?.id_token || "";

  const[devices, setDevices] = useState();
  const[userDev, setUserDev] = useState();
  const [sensorBoxModel, setSensorBoxModel] = useState(["", "", ""]);
  const [tokenExchangeResult, setTokenExchangeResult] = useState(null);
  const [microsoftLoginMessage, setMicrosoftLoginMessage] = useState("");
  const [deviceCodeForPolling, setDeviceCodeForPolling] = useState("");
  const [isTokenPolling, setIsTokenPolling] = useState(false);
  const [triggerFileName, setTriggerFileName] = useState("");
  const [triggerStatus, setTriggerStatus] = useState("");
  const [isTriggeringWebhook, setIsTriggeringWebhook] = useState(false);

  // Microsoft OAuth config (customized)
  const MS_TENANT = "consumers";
  const MS_CLIENT_ID = "e2f751a9-87fe-4a89-982d-d73b8b8c2f19";
  const MS_REDIRECT_URI = "https://rht-iot.github.io/ReactWeb/admin";
  const MS_SCOPE = "Files.ReadWrite offline_access";
  const MS_STATE = "12345";

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
  const microsoftLogin = async () => {
    if (!awsAccessToken) {
      setMicrosoftLoginMessage("AWS access token is missing. Please sign in first.");
      return;
    }

    try {
      setTokenExchangeResult(null);
      setDeviceCodeForPolling("");
      setIsTokenPolling(false);

      const response = await fetch(AWS_MICROSOFT_LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${awsAccessToken}`,
        }
      });

      const json = await parseApiResponse(response);
      let payload = json;
      if (typeof json?.body === "string") {
        try {
          payload = JSON.parse(json.body);
        } catch {
          payload = json;
        }
      } else if (json?.body && typeof json.body === "object") {
        payload = json.body;
      }

      const messageFromBody =
        payload?.message ||
        (() => {
          if (typeof json?.body !== "string") return "";
          try {
            return JSON.parse(json.body)?.message || "";
          } catch {
            return "";
          }
        })();

      if (!response.ok) {
        throw new Error(
          payload?.error_description ||
            payload?.error?.message ||
            json?.error_description ||
            "Device code request failed"
        );
      }

      if (messageFromBody) {
        setMicrosoftLoginMessage(messageFromBody);
      }

      if (payload?.device_code) {
        setDeviceCodeForPolling(payload.device_code);
        setIsTokenPolling(true);
      }

      const target = payload?.verification_uri_complete || payload?.verification_uri;
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setMicrosoftLoginMessage(error instanceof Error ? error.message : "Device code request failed");
    }
  };
  // const difyTrig = () => {
  //   return fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/dify_trig", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       "Authorization": `Bearer ${auth.user?.id_token}`,
  //     },
  //     body: JSON.stringify(refresh_send),
  //   });
  // };
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
        }else{
          payload.push({ email: user, Location: loc });
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const returningState = params.get("state");
    if (!authCode) return;
    if (returningState && returningState !== MS_STATE) {
      console.warn("State mismatch, aborting token exchange.");
      return;
    }

    const exchangeToken = async () => {
      try {
        const body = new URLSearchParams({
          client_id: MS_CLIENT_ID,
          scope: MS_SCOPE,
          code: authCode,
          redirect_uri: MS_REDIRECT_URI,
          grant_type: "authorization_code",
        });
        const response = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
        const json = await response.json();
        setTokenExchangeResult(json);
      } catch (error) {
        console.error("Token exchange failed:", error);
      } finally {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    exchangeToken();
  }, [MS_CLIENT_ID, MS_REDIRECT_URI, MS_SCOPE, MS_STATE]);

  useEffect(() => {
    if (!isTokenPolling || !deviceCodeForPolling) return;

    let inFlight = false;

    const pollToken = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const response = await fetch(AWS_MS_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${awsAccessToken}`,
          },
          body: JSON.stringify({
            "device_code": deviceCodeForPolling
          }),
        });

        const json = await parseApiResponse(response);
        const awsStatusCode = typeof json?.statusCode === "number" ? json.statusCode : response.status;
        let payload = json;
        if (typeof json?.body === "string") {
          try {
            payload = JSON.parse(json.body);
          } catch {
            payload = json;
          }
        } else if (json?.body && typeof json.body === "object") {
          payload = json.body;
        }
        
        if (awsStatusCode === 200) {
          setTokenExchangeResult(payload);
          // setMicrosoftLoginMessage("Authentication completed. Access token received.");
          setIsTokenPolling(false);
          return;
        }

        const errorCode = payload?.error;
        if (errorCode === "authorization_pending" || errorCode === "slow_down") {
          return;
        }

        setMicrosoftLoginMessage(payload?.error_description || "Device token polling failed");
        setIsTokenPolling(false);
      } catch (error) {
        setMicrosoftLoginMessage(error instanceof Error ? error.message : "Device token polling failed");
        setIsTokenPolling(false);
      } finally {
        inFlight = false;
      }
    };

    pollToken();
    const timer = window.setInterval(pollToken, 5000);
    return () => window.clearInterval(timer);
  }, [MS_CLIENT_ID, MS_TENANT, awsAccessToken, deviceCodeForPolling, isTokenPolling]);

  const handleTriggerWebhook = async () => {
    const accessToken = tokenExchangeResult?.access_token || tokenExchangeResult?.accessToken;

    if (!accessToken) {
      setTriggerStatus("Access token is missing. Please complete Microsoft sign-in first.");
      return;
    }

    if (!triggerFileName.trim()) {
      setTriggerStatus("Please enter a file name.");
      return;
    }
    try {
      setIsTriggeringWebhook(true);
      setTriggerStatus("");

      const response = await fetch(AWS_DIFY_TRIG_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${awsAccessToken}`,
        },
        body: JSON.stringify({
          access_token: accessToken,
          file_name: triggerFileName.trim(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Webhook call failed");
      }

      setTriggerStatus("Webhook triggered successfully.");
    } catch (error) {
      setTriggerStatus(error instanceof Error ? error.message : "Webhook call failed");
    } finally {
      setIsTriggeringWebhook(false);
    }
  };
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
        <button
          className="brand-button button-outline"
          onClick={microsoftLogin}
        >
          Sign in with Microsoft
        </button>
      </div>

      {microsoftLoginMessage && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="section-title">Microsoft Sign-in Message</div>
          <p>{microsoftLoginMessage}</p>
          {isTokenPolling && <p>Polling token endpoint every 5 seconds…</p>}
        </div>
      )}

      {/* {tokenExchangeResult && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="section-title">Microsoft Token Response</div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {JSON.stringify(tokenExchangeResult, null, 2)}
          </pre>
        </div>
      )} */}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">Trigger Webhook</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            value={triggerFileName}
            onChange={(e) => setTriggerFileName(e.target.value)}
            placeholder="Enter file name"
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, minWidth: 260 }}
          />
          <button
            className="brand-button button-outline"
            onClick={handleTriggerWebhook}
            disabled={isTriggeringWebhook}
          >
            {isTriggeringWebhook ? "Triggering…" : "Trigger Webhook"}
          </button>
        </div>
        {triggerStatus && <p style={{ marginTop: 8 }}>{triggerStatus}</p>}
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
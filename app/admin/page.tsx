
"use client";

import { useAuth } from "react-oidc-context";
import { useEffect, useState, useCallback } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance, loginRequest, initializeMsal } from "../authConfig";
import { asset } from "../lib/asset";

const PKCE_VERIFIER_STORAGE_KEY = "ms_pkce_verifier";

function base64UrlEncode(arrayBuffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(length = 64) {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    return "";
  }
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => charset[value % charset.length]).join("");
}

async function generateCodeChallenge(verifier: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return "";
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}
// Redirects to Microsoft OAuth2 authorize endpoint (customized)
function redirectToMicrosoftSignIn(tenant, clientId, redirectUri, scope, state, codeChallenge?, codeChallengeMethod = "S256") {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scope,
    state: state,
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", codeChallengeMethod);
  }
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  window.location.href = url;
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

  const[devices, setDevices] = useState();
  const[userDev, setUserDev] = useState();
  const [sensorBoxModel, setSensorBoxModel] = useState(["", "", ""]);
  const [pkce, setPkce] = useState({ verifier: "", challenge: "" });
  const [tokenExchangeResult, setTokenExchangeResult] = useState(null);
  const [driveSearchResult, setDriveSearchResult] = useState(null);
  const [driveSearchError, setDriveSearchError] = useState("");
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [driveFilesError, setDriveFilesError] = useState("");
  const [isMsalBusy, setIsMsalBusy] = useState(false);

  // Microsoft OAuth config (customized)
  const MS_TENANT = "6cb89794-7b66-472d-b0b1-09ed68dafe30";
  const MS_CLIENT_ID = "231cd4ed-db1c-413d-ab9c-643a61712ee8";
  const MS_REDIRECT_URI = "http://localhost:3000";
  const MS_SCOPE = "User.Read Files.ReadWrite";
  const MS_STATE = "12345";

  const initializePkcePair = useCallback(async (reuseExisting = true) => {
    if (typeof window === "undefined") return;
    try {
      let verifier = reuseExisting ? window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY) : null;
      if (!verifier) {
        verifier = generateCodeVerifier();
        if (!verifier) {
          console.warn("Unable to generate PKCE code_verifier.");
          return;
        }
        window.sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
      }
      const challenge = await generateCodeChallenge(verifier);
      if (!challenge) {
        console.warn("Unable to generate PKCE code_challenge.");
        return;
      }
      setPkce({ verifier, challenge });
    } catch (error) {
      console.error("Failed to initialize PKCE pair:", error);
    }
  }, []);

  useEffect(() => {
    initializePkcePair();
  }, [initializePkcePair]);

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
      const storedVerifier = window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
      if (!storedVerifier) {
        console.warn("Missing PKCE code_verifier; cannot exchange authorization code.");
        return;
      }
      try {
        const body = new URLSearchParams({
          client_id: MS_CLIENT_ID,
          scope: MS_SCOPE,
          code: authCode,
          redirect_uri: MS_REDIRECT_URI,
          grant_type: "authorization_code",
          code_verifier: storedVerifier,
        });
        const response = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
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
        window.sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
        initializePkcePair(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    exchangeToken();
  }, [MS_CLIENT_ID, MS_REDIRECT_URI, MS_SCOPE, MS_STATE, MS_TENANT, initializePkcePair]);
  const [firstName, setFirstName] = useState('');

  const handleMicrosoftSignIn = useCallback(async () => {
    if (isMsalBusy) return; // avoid overlapping popups
    setIsMsalBusy(true);
    setDriveFilesError("");
    setIsLoadingFiles(true);

    try {
      await initializeMsal();

      const accounts = msalInstance.getAllAccounts();
      let activeAccount = accounts[0] || msalInstance.getActiveAccount();

      if (!activeAccount) {
        try {
          const loginResponse = await msalInstance.loginPopup(loginRequest);
          activeAccount = loginResponse.account;
        } catch (err) {
          if ((err as any)?.errorCode === "interaction_in_progress") {
            setDriveFilesError("Finish or close the previous Microsoft sign-in popup, then try again.");
            return;
          }
          throw err;
        }
      }

      if (activeAccount && msalInstance.setActiveAccount) {
        msalInstance.setActiveAccount(activeAccount);
      }

      let tokenResponse;
      try {
        tokenResponse = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: activeAccount,
        });
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          try {
            tokenResponse = await msalInstance.acquireTokenPopup({ ...loginRequest, account: activeAccount });
          } catch (popupErr) {
            if ((popupErr as any)?.errorCode === "interaction_in_progress") {
              setDriveFilesError("Finish or close the previous Microsoft sign-in popup, then try again.");
              return;
            }
            throw popupErr;
          }
        } else {
          throw err;
        }
      }

      const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children", {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      });
      const graphJson = await graphResponse.json();
      if (!graphResponse.ok) {
        throw new Error(graphJson?.error?.message || "Graph request failed");
      }

      setDriveFiles(graphJson.value || []);
      setTokenExchangeResult(tokenResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Microsoft sign-in failed";
      setDriveFilesError(message);
      console.error("MSAL sign-in failed:", err);
    } finally {
      setIsLoadingFiles(false);
      setIsMsalBusy(false);
    }
  }, [isMsalBusy]);

  const handleOneDriveSearch = async () => {
    const accessToken = tokenExchangeResult?.accessToken || tokenExchangeResult?.access_token;
    if (!accessToken) {
      setDriveSearchError("Retrieve an access token first.");
      return;
    }

    const searchTerm = "202602_Amber";
    const encodedTerm = encodeURIComponent(searchTerm);
    const url = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodedTerm}')`;

    try {
      setIsSearchingDrive(true);
      setDriveSearchError("");
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        setDriveSearchResult(null);
        setDriveSearchError(data?.error?.message || "Graph search failed.");
        return;
      }
      setDriveSearchResult(data);
    } catch (error) {
      setDriveSearchResult(null);
      setDriveSearchError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSearchingDrive(false);
    }
  };

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
          style={{ marginLeft: 12 }}
          onClick={handleMicrosoftSignIn}
          disabled={isLoadingFiles}
        >
          {isLoadingFiles ? "Loading OneDrive…" : "Sign in with Microsoft"}
        </button>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">OneDrive Root Files</div>
        {driveFilesError && (
          <p style={{ color: "red", marginBottom: 8 }}>{driveFilesError}</p>
        )}
        <button
          className="brand-button button-outline"
          onClick={handleMicrosoftSignIn}
          disabled={isLoadingFiles}
        >
          {isLoadingFiles ? "Loading OneDrive…" : "Sign in & Load Files"}
        </button>
        {driveFiles.length === 0 && !driveFilesError ? (
          <p style={{ marginTop: 8 }}>Sign in to see your OneDrive files.</p>
        ) : (
          <ul style={{ marginTop: 12 }}>
            {driveFiles.map((file) => (
              <li key={file.id}>{file.name}</li>
            ))}
          </ul>
        )}
      </div>

      {tokenExchangeResult && (
        <>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="section-title">Microsoft Token Response</div>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(tokenExchangeResult, null, 2)}
            </pre>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="section-title">OneDrive Search</div>
            <p>Search term: <strong>202602_Amber</strong></p>
            <button
              className="brand-button button-outline"
              onClick={handleOneDriveSearch}
              disabled={isSearchingDrive}
            >
              {isSearchingDrive ? "Searching…" : "Search OneDrive"}
            </button>
            {driveSearchError && (
              <p style={{ color: "red", marginTop: 8 }}>{driveSearchError}</p>
            )}
            {driveSearchResult && (
              <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(driveSearchResult, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    
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
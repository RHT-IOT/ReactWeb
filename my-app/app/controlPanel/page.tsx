"use client";

import { useAuth } from "react-oidc-context";
import { useEffect, useMemo, useState } from "react";
import { getIMEIList } from "../lib/aws";

export default function AdminPage() {
  const auth = useAuth();

  const [imeiArr, setIMEIArr] = useState<any[]>([]);
  const [selectedIMEI, setSelectedIMEI] = useState<string>("");
  const [cpNames, setCpNames] = useState<string[]>([]);
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>("");

  const deviceTypes = useMemo(() => {
    const types = Array.from(new Set(cpNames
      .map((n) => (typeof n === "string" && n.includes("/") ? n.split("/")[0] : ""))
      .filter(Boolean)
    )) as string[];
    return types;
  }, [cpNames]);

  const dataTypes = useMemo(() => {
    if (!selectedDeviceType) return [] as string[];
    return cpNames
      .filter((n) => typeof n === "string" && n.startsWith(selectedDeviceType + "/"))
      .map((n) => {
        const parts = n.split("/");
        return parts[1] || n;
      });
  }, [cpNames, selectedDeviceType]);

  async function loadIMEIs() {
    if (!auth?.isAuthenticated || !auth.user?.id_token || !auth.user?.profile?.email) return;
    try {
      const list = await getIMEIList(auth.user.profile.email, auth.user.id_token as string);
      const items = Array.isArray(list.items) ? list.items : [];
      setIMEIArr(items);
      const first = String(items?.[0]?.DeviceID || "");
      setSelectedIMEI(first);
      if (first) await fetchCPNames(first);
    } catch (e) {
      console.error("loadIMEIs error", e);
    }
  }

  async function fetchCPNames(imei: string) {
    if (!imei || !auth?.user?.id_token) return;
    try {
      const res = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getCPname", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth.user.id_token}`,
        },
        body: JSON.stringify({ IMEI: Number(imei) }),
      });
      const data = await res.json();
      const parsed = typeof data.body === "string" ? JSON.parse(data.body) : data.body;
      const names = Array.isArray(parsed?.items)
        ? parsed.items.map(String)
        : Array.isArray(parsed)
        ? parsed.map(String)
        : Array.isArray(parsed?.nameList)
        ? parsed.nameList.map(String)
        : [];
      setCpNames(names);
      setNameInputs(names.reduce((acc: Record<string, string>, n: string) => { acc[n] = acc[n] ?? ""; return acc; }, {}));
      const firstDeviceType = Array.isArray(names) && names.length ? String(names[0]).split("/")[0] : "";
      setSelectedDeviceType(firstDeviceType || "");
    } catch (e) {
      console.error("fetchCPNames error", e);
    }
  }

  useEffect(() => { loadIMEIs(); }, [auth.isAuthenticated, auth.user?.id_token, auth.user?.profile?.email]);

  useEffect(() => {
    if (!selectedDeviceType && deviceTypes.length > 0) {
      setSelectedDeviceType(deviceTypes[0]);
    }
  }, [deviceTypes, selectedDeviceType]);

  function handleInputChange(name: string, value: string) {
    setNameInputs(prev => ({ ...prev, [name]: value }));
  }

  async function sendCpValue(deviceType: string, dataType: string) {
    if (!auth?.user?.id_token || !selectedIMEI) return;
    const key = `${deviceType}/${dataType}`;
    const value = nameInputs[key] ?? "";
    try {
      const res = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/setCPvalue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth.user.id_token}`,
        },
        body: JSON.stringify({ IMEI: Number(selectedIMEI), DeviceType: deviceType, DataType: dataType, Value: value }),
      });
      if (!res.ok) {
        console.error("setCPvalue failed", await res.text());
      }
    } catch (e) {
      console.error("setCPvalue error", e);
    }
  }

  return (
    <div className="page-container" style={{ paddingTop: 24 }}>
      <div className="brand-header" style={{ display: "flex", alignItems: "center", padding: "8px 12px" }}>
        <span className="brand-title">Control Panel</span>
        <button className="brand-button button-outline" style={{ marginLeft: "auto" }} onClick={() => window.location.replace("/login")}>
          Back to Dashboard
        </button>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">Select IMEI</div>
        <div className="control-row" style={{ gap: 8 }}>
          <select className="brand-select" value={selectedIMEI} onChange={(e) => { const v = e.target.value; setSelectedIMEI(v); fetchCPNames(v); }}>
            {imeiArr.map((d: any, idx: number) => (
              <option key={idx} value={String(d.DeviceID)}>{d.Location || String(d.DeviceID)}</option>
            ))}
          </select>
          <button className="brand-button" onClick={() => fetchCPNames(selectedIMEI)} disabled={!selectedIMEI}>Load Names</button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">Select Device</div>
        <div className="control-row" style={{ gap: 8 }}>
          <select className="brand-select" value={selectedDeviceType} onChange={(e) => setSelectedDeviceType(e.target.value)}>
            {deviceTypes.map((dt, idx) => (
              <option key={idx} value={dt}>{dt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-title">Gauge Grid (Datatype + Input)</div>
        {!selectedDeviceType || dataTypes.length === 0 ? (
          <pre>No datatypes for device {selectedDeviceType || '-'} (IMEI {selectedIMEI || '-'}).</pre>
        ) : (
          <div className="dashboard-grid" style={{ gap: 16 }}>
            {dataTypes.map((dt, idx) => {
              const key = `${selectedDeviceType}/${dt}`;
              return (
                <div key={idx} className="panel" style={{ padding: 12 }}>
                  <div className="section-title" style={{ marginBottom: 8 }}>{selectedDeviceType}/{dt}</div>
                  <div className="control-row" style={{ gap: 8 }}>
                    <input
                      type="text"
                      className="brand-input"
                      placeholder="Enter value"
                      value={nameInputs[key] || ""}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                    />
                    <button className="brand-button" onClick={() => sendCpValue(selectedDeviceType, dt)}>Send</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
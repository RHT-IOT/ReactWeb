"use client";

import { useAuth } from "react-oidc-context";
import { useEffect, useMemo, useState } from "react";
import { getIMEIList, getLatestDP } from "../lib/aws";

export default function AdminPage() {
  const auth = useAuth();
  // Apply saved theme and mode so background matches other pages
  useEffect(() => {
    const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('theme-name')) as 'theme-a' | 'theme-b' | 'theme-c' | null;
    const savedMode = (typeof window !== 'undefined' && localStorage.getItem('mode-name')) as 'mode-light' | 'mode-dark' | null;
    const cls = document.body.classList;
    cls.remove('theme-a', 'theme-b', 'theme-c', 'mode-light', 'mode-dark');
    cls.add(savedTheme || 'theme-a');
    cls.add(savedMode || 'mode-light');
  }, []);

  const [imeiArr, setIMEIArr] = useState<any[]>([]);
  const [selectedIMEI, setSelectedIMEI] = useState<string>("");
  const [cpNames, setCpNames] = useState<string[]>([]);
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>("");
  const [allowedByDeviceId, setAllowedByDeviceId] = useState<Record<string, string[]>>({});
  const [latestMap, setLatestMap] = useState<Record<string, any>>({});
  const [isSendingAll, setIsSendingAll] = useState<boolean>(false);

  const deviceTypes = useMemo(() => {
    const allowed = allowedByDeviceId[String(selectedIMEI)] || [];
    if (allowed.length > 0) return allowed;
    // Fallback: derive from cpNames if backend doesn't return dev_access
    const types = Array.from(new Set(cpNames
      .map((n) => (typeof n === "string" && n.includes("/") ? n.split("/")[0] : ""))
      .filter(Boolean)
    )) as string[];
    return types;
  }, [allowedByDeviceId, selectedIMEI, cpNames]);

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
      const access = Array.isArray(list.dev_access) ? list.dev_access : [];
      const map: Record<string, string[]> = {};
      items.forEach((it, idx) => {
        const devs = Array.isArray(access[idx]) ? access[idx].map(String) : [];
        map[String(it.DeviceID)] = devs;
      });
      setAllowedByDeviceId(map);
      setIMEIArr(items);
      const first = String(items?.[0]?.DeviceID || "");
      setSelectedIMEI(first);
      // Preselect first allowed device for first IMEI if available
      const allowedForFirst = map[String(items?.[0]?.DeviceID)] || [];
      setSelectedDeviceType(allowedForFirst[0] || "");
      if (first) await fetchCPNames(first);
    } catch (e) {
      console.error("loadIMEIs error", e);
    }
  }

  async function refreshLatest(imei: string) {
    if (!imei || !auth?.user?.id_token) return;
    try {
      const result = await getLatestDP(imei, auth.user.id_token as string);
      setLatestMap(result.deviceMap || {});
    } catch (e) {
      console.error("getLatestDP error", e);
    }
  }

  async function fetchCPNames(imei: string) {
    if (!imei || !auth?.user?.id_token) return;
    async function authFetchRetry(url: string, init: RequestInit) {
      let res = await fetch(url, init);
      if (res.status === 401 || res.status === 403) {
        try {
          const fn: any = (auth as any)?.signinSilent;
          if (typeof fn === 'function') {
            const user = await fn();
            const tk = (user as any)?.id_token ?? auth.user.id_token;
            const nextInit = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${tk}` } };
            res = await fetch(url, nextInit);
          }
        } catch {}
      }
      return res;
    }
    try {
      const res = await authFetchRetry("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getCPname", {
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
      await refreshLatest(imei);
    } catch (e) {
      console.error("fetchCPNames error", e);
    }
  }

  useEffect(() => { loadIMEIs(); }, [auth.isAuthenticated, auth.user?.id_token, auth.user?.profile?.email]);

  useEffect(() => {
    if (deviceTypes.length > 0) {
      if (!selectedDeviceType || !deviceTypes.includes(selectedDeviceType)) {
        setSelectedDeviceType(deviceTypes[0]);
      }
    } else if (selectedDeviceType) {
      setSelectedDeviceType("");
    }
  }, [deviceTypes, selectedDeviceType]);

  function handleInputChange(name: string, value: string) {
    setNameInputs(prev => ({ ...prev, [name]: value }));
  }

  async function sendCpValue(deviceType: string, dataType: string | string[]) {
    if (!auth?.user?.id_token || !selectedIMEI) return;
    const types = Array.isArray(dataType) ? dataType : [dataType];
    const send_arr: [string, string][] = types.map((dt) => {
      const key = `${deviceType}/${String(dt)}`;
      const value = nameInputs[key] ?? "";
      return [key, value];
    });
    try {
      const res = await authFetchRetry("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/setCPvalue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth.user.id_token}`,
        },
        body: JSON.stringify({ IMEI: Number(selectedIMEI), DevDpValue: send_arr }),
      });
      if (!res.ok) {
        console.error("setCPvalue failed", await res.text());
      }
    } catch (e) {
      console.error("setCPvalue error", e);
    }
  }

  async function authFetchRetry(url: string, init: RequestInit, retries = 2, delayMs = 1000): Promise<Response> {
    let lastErr: any = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, init);
        if (res.ok || attempt === retries) return res;
        // If not OK, wait and retry
      } catch (err) {
        lastErr = err;
        if (attempt === retries) throw err;
      }
      await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
    }
    // Fallback throw if we somehow get here
    throw lastErr ?? new Error("authFetchRetry failed");
  }

  // Prefill inputs from latest DP for the selected device without overriding user-entered values
  useEffect(() => {
    if (!selectedDeviceType || !latestMap || dataTypes.length === 0) return;
    const entry = latestMap[selectedDeviceType];
    if (!entry) return;
    setNameInputs(prev => {
      const next = { ...prev } as Record<string, string>;
      dataTypes.forEach((dt) => {
        const key = `${selectedDeviceType}/${dt}`;
        const raw = entry[dt];
        if (typeof raw !== "undefined" && (prev[key] === undefined || prev[key] === "")) {
          next[key] = String(raw);
        }
      });
      return next;
    });
  }, [latestMap, selectedDeviceType, dataTypes]);

  async function sendAll() {
    console.log("sendAll:", dataTypes);
    if (!selectedDeviceType || dataTypes.length === 0) return;
    setIsSendingAll(true);
    try {
      await sendCpValue(selectedDeviceType, dataTypes);
    } catch (e) {
      console.error("sendAll error", e);
    } finally {
      setIsSendingAll(false);
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
          <select className="brand-select" value={selectedIMEI} onChange={(e) => { const v = e.target.value; setSelectedIMEI(v); setSelectedDeviceType(""); fetchCPNames(v); }}>
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
        <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Gauge Grid (Datatype + Input)</span>
          <button
            className="brand-button button-outline"
            onClick={sendAll}
            disabled={!selectedDeviceType || dataTypes.length === 0 || isSendingAll}
          >
            {isSendingAll ? "Sending..." : "Send All"}
          </button>
        </div>
        {!selectedDeviceType || dataTypes.length === 0 ? (
          <pre>No datatypes for device {selectedDeviceType || '-'} (IMEI {selectedIMEI || '-'}).</pre>
        ) : (
          <div className="dashboard-grid" style={{ gap: 16 }}>
            {dataTypes.map((dt, idx) => {
              const key = `${selectedDeviceType}/${dt}`;
              return (
                <div key={idx} className="panel" style={{ padding: 12 }}>
                  <div className="section-title" style={{ marginBottom: 8 }}>{dt}</div>
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
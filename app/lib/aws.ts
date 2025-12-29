// Shared AWS data client for IMEI/device data access
// Provides small, focused functions and a lightweight poller

export type LatestDPResult = {
  deviceMap: Record<string, any>;
  deviceTypes: Record<string, string> | string[];
};

export type DeviceInfo = {
  Location: string;
  DeviceID: string | number;
  Coordinate: [number, number]; // [lat, lng]
};

export type IMEIListResult = { items: DeviceInfo[]; dev_access: string[][] };

async function fetchWithAuthRetry(url: string, initBody: any, idToken: string, getIdToken?: () => Promise<string>, method: string = "POST") {
  const make = async (tk: string) =>
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tk}` },
      body: JSON.stringify(initBody),
    });
  let res = await make(idToken);
  if ((res.status === 401 || res.status === 403) && getIdToken) {
    try {
      const newTk = await getIdToken();
      if (newTk) res = await make(newTk);
    } catch (e) {
      // swallow and fall through
    }
  }
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.url = url;
    try { err.body = await res.text(); } catch {}
    throw err;
  }
  return res;
}

export async function getIMEIList(email: string, idToken: string, getIdToken?: () => Promise<string>): Promise<IMEIListResult> {
  const res = await fetchWithAuthRetry("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getIMEI", { email }, idToken, getIdToken);
  const data = await res.json();
  let body: any = {};
  try {
    body = JSON.parse(data?.body ?? "{}");
  } catch (e) {
    console.error("getIMEIList JSON parse error", e);
  }
  const itemsRaw = Array.isArray(body?.items) ? body.items : [];
  const devAccessRaw = Array.isArray(body?.dev_access) ? body.dev_access : [];
  const items: DeviceInfo[] = (itemsRaw as DeviceInfo[]).filter(d => Array.isArray(d.Coordinate) && d.Coordinate.length === 2);
  const dev_access: string[][] = devAccessRaw.map((a: any) => Array.isArray(a) ? a.map(String) : []);
  return { items, dev_access };
}

export async function getLatestDP(IMEI: string, idToken: string, getIdToken?: () => Promise<string>): Promise<LatestDPResult> {
  const res = await fetchWithAuthRetry("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getLatestDP", { IMEI }, idToken, getIdToken);
  const data = await res.json();
  const temp = JSON.parse(data.body ?? "[]");
  const map: Record<string, any> = {};
  const dev: Record<string, string> = {};
  let idx = 0;
  for (const item of temp) {
    dev[idx] = item.DeviceType;
    map[item.DeviceType] = item;
    idx++;
  }
  return { deviceMap: map, deviceTypes: dev };
}

export async function getIMEIOffline(email: string, idToken: string, getIdToken?: () => Promise<string>): Promise<any> {
  const res = await fetchWithAuthRetry("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getIMEIOffline", { email }, idToken, getIdToken);
  const data = await res.json();
  try {
    return JSON.parse(data.body ?? "{}");
  } catch {
    return data;
  }
}

export async function getDPFromTime(
  IMEI: string,
  startDateTime: string,
  endDateTime: string,
  idToken: string,
  timeInterval: string,
  getIdToken?: () => Promise<string>
): Promise<{ deviceTypes: string[]; items: any[] }> {
  const res = await fetchWithAuthRetry("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getDpFromTime", { IMEI, startDateTime, endDateTime, timeInterval }, idToken, getIdToken);
  const data = await res.json();
  const temp = JSON.parse(data.body ?? "{}");
  return { deviceTypes: temp.deviceTypes || [], items: temp.items || [] };
}

export function createLatestDpPoller({
  IMEI,
  idToken,
  getIdToken,
  intervalMs = 5 * 60 * 1000,
  callback,
  errorCallback,
}: {
  IMEI: string | string[];
  idToken: string;
  getIdToken?: () => Promise<string>;
  intervalMs?: number;
  callback: (result: LatestDPResult) => void;
  errorCallback?: (error: any) => void;
}) {
  let timer: number | null = null;
  let currentToken = idToken;

  async function tick() {
    try {
      let result: LatestDPResult;
      
      const fetchOne = async (imei: string, tk: string) => getLatestDP(imei, tk);

      const fetchAll = async (tk: string) => {
        if (Array.isArray(IMEI)) {
          const list = await Promise.all(IMEI.map(i => fetchOne(i, tk)));
          const map: Record<string, any> = {};
          // Merge maps, prefixing keys with IMEI to avoid collisions
          list.forEach((res, idx) => {
            const imei = IMEI[idx];
            if (res && res.deviceMap) {
              Object.keys(res.deviceMap).forEach(k => {
                map[`${imei}_${k}`] = res.deviceMap[k];
              });
            }
          });
          return { deviceMap: map, deviceTypes: {} };
        }
        return await fetchOne(IMEI, tk);
      };

      try {
        result = await fetchAll(currentToken);
      } catch (e: any) {
        if ((e?.status === 401 || e?.status === 403) && getIdToken) {
          try {
            const newTk = await getIdToken();
            if (newTk) {
              currentToken = newTk;
              result = await fetchAll(currentToken);
            } else {
              throw e;
            }
          } catch (inner) {
            throw inner ?? e;
          }
        } else {
          throw e;
        }
      }
      callback(result);
    } catch (e) {
      console.error("Poller tick failed:", e);
      try { errorCallback?.(e); } catch {}
    }
  }

  return {
    async start() {
      await tick();
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    },
  };
}



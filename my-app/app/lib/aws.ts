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

export async function getIMEIList(email: string, idToken: string): Promise<DeviceInfo[]> {
  const res = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getIMEI", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  let arr: unknown = [];
  try {
    arr = JSON.parse(data?.body ?? "[]");
  } catch (e) {
    console.error("getIMEIList JSON parse error", e);
  }
  if (!Array.isArray(arr)) return [];
  // Trust the API to return desired shape
  return (arr as DeviceInfo[]).filter(d => Array.isArray(d.Coordinate) && d.Coordinate.length === 2);
}

export async function getLatestDP(IMEI: string, idToken: string): Promise<LatestDPResult> {
  const res = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getLatestDP", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ IMEI }),
  });
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

export async function getDPFromTime(
  IMEI: string,
  startDateTime: string,
  endDateTime: string,
  idToken: string
): Promise<{ deviceTypes: string[]; items: any[] }> {
  const res = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getDpFromTime", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ IMEI, startDateTime, endDateTime }),
  });
  const data = await res.json();
  const temp = JSON.parse(data.body ?? "{}");
  return { deviceTypes: temp.deviceTypes || [], items: temp.items || [] };
}

export function createLatestDpPoller({
  IMEI,
  idToken,
  intervalMs = 5 * 60 * 1000,
  callback,
}: {
  IMEI: string;
  idToken: string;
  intervalMs?: number;
  callback: (result: LatestDPResult) => void;
}) {
  let timer: number | null = null;

  async function tick() {
    try {
      const result = await getLatestDP(IMEI, idToken);
      callback(result);
    } catch (e) {
      console.error("Poller tick failed:", e);
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
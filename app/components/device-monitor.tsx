import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

interface DeviceMonitorProps {
  devices: Record<string, number>[];
}

export function DeviceMonitor({ devices }: DeviceMonitorProps) {
  // Transform the array of objects into a usable format
  const deviceList = devices.flatMap((deviceObj, index) => 
    Object.entries(deviceObj).map(([name, status]) => ({
      id: `${name}-${index}`,
      name,
      online: status === 1
    }))
  );

  const onlineCount = deviceList.filter(d => d.online).length;
  const totalCount = deviceList.length;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="mb-2">Site Monitor</h1>
        <p className="text-muted-foreground">
          {onlineCount} of {totalCount} sites online
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {deviceList.map((device) => (
          <div
            key={device.id}
            className={`aspect-square p-6 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${
              device.online
                ? "bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 hover:shadow-green-200/50 hover:shadow-lg dark:from-green-950/20 dark:to-green-900/10 dark:border-green-800"
                : "bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 hover:shadow-red-200/50 hover:shadow-lg dark:from-red-950/20 dark:to-red-900/10 dark:border-red-800"
            }`}
          >
            <span className={`text-center break-words w-full text-black dark:text-white`}>
              {device.name}
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  device.online
                    ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                    : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                }`}
              />
              <span className={`text-sm ${
                device.online ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              }`}>
                {device.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
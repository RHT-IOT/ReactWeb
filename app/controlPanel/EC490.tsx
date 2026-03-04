import { useState, useEffect } from 'react';
import { Power, Wind, ChevronUp, ChevronDown } from 'lucide-react';

interface AirPurifierPanelProps {
  onPowerOn?: () => void;
  onPowerOff?: () => void;
  onFanSpeedIncrease?: (newSpeed: number) => void;
  onFanSpeedDecrease?: (newSpeed: number) => void;
  latestData?: Record<string, any>;
}

export function AirPurifierPanel({ 
  onPowerOn,
  onPowerOff,
  onFanSpeedIncrease,
  onFanSpeedDecrease,
  latestData
}: AirPurifierPanelProps) {
  const [isOn, setIsOn] = useState(false);
  const [fanSpeed, setFanSpeed] = useState(1);

  useEffect(() => {
    if (latestData) {
      if (latestData.On_Off !== undefined) {
        setIsOn(String(latestData.On_Off) === "1");
      }
      if (latestData.Fan_Speed !== undefined) {
        const speed = Number(latestData.Fan_Speed);
        if (!isNaN(speed)) {
          setFanSpeed(speed);
        }
      }
    }
  }, [latestData]);

  const handlePowerToggle = () => {
    const newState = !isOn;
    setIsOn(newState);
    
    // Call the appropriate function based on the new state
    if (newState) {
      // Power turned ON
      if (onPowerOn) {
        onPowerOn();
      }
    } else {
      // Power turned OFF
      if (onPowerOff) {
        onPowerOff();
      }
    }
  };

  const handleIncrease = () => {
    if (fanSpeed < 10) {
      const newSpeed = fanSpeed + 1;
      setFanSpeed(newSpeed);
      
      if (onFanSpeedIncrease) {
        onFanSpeedIncrease(newSpeed);
      }
    }
  };

  const handleDecrease = () => {
    if (fanSpeed > 1) {
      const newSpeed = fanSpeed - 1;
      setFanSpeed(newSpeed);
      
      if (onFanSpeedDecrease) {
        onFanSpeedDecrease(newSpeed);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <Wind className={`w-8 h-8 ${isOn ? 'text-purple-500' : 'text-gray-400'}`} />
          <h1>490EC Air Purifier</h1>
        </div>
        <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>

      {/* Fan Speed Display */}
      <div className="text-center mb-12">
        <div className={`text-6xl mb-2 transition-colors ${isOn ? 'text-purple-600' : 'text-gray-400'}`}>
          {fanSpeed}
        </div>
        <div className="text-gray-500">
          {isOn ? 'Fan Speed' : 'System Off'}
        </div>
      </div>

      {/* Fan Speed Control Buttons */}
      <div className="flex gap-4 mb-12">
        <button
          onClick={handleDecrease}
          disabled={!isOn || fanSpeed === 1}
          className={`flex-1 py-6 rounded-2xl transition-all flex flex-col items-center justify-center ${
            isOn && fanSpeed > 1
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ChevronDown className="w-8 h-8 mb-1" />
          <div className="text-sm">Decrease</div>
        </button>

        <button
          onClick={handleIncrease}
          disabled={!isOn || fanSpeed === 10}
          className={`flex-1 py-6 rounded-2xl transition-all flex flex-col items-center justify-center ${
            isOn && fanSpeed < 10
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ChevronUp className="w-8 h-8 mb-1" />
          <div className="text-sm">Increase</div>
        </button>
      </div>

      {/* Power Button */}
      <button
        onClick={handlePowerToggle}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${
          isOn
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
            : 'bg-gray-800 hover:bg-gray-900 text-white shadow-lg'
        }`}
      >
        <Power className="w-6 h-6" />
        <span>{isOn ? 'Turn Off' : 'Turn On'}</span>
      </button>
    </div>
  );
}
import { useState } from 'react';
import { Power, Snowflake } from 'lucide-react';

interface AirConPanelProps {
  onPowerToggle?: (isOn: boolean) => void;
  onLowTempClick?: () => void;
  onHighTempClick?: () => void;
}

export function AirConPanel({ 
  onPowerToggle, 
  onLowTempClick, 
  onHighTempClick 
}: AirConPanelProps) {
  const [isOn, setIsOn] = useState(false);
  const [temperature, setTemperature] = useState(24);

  const handlePowerToggle = () => {
    const newState = !isOn;
    setIsOn(newState);
    
    // Your custom code here - this function will be called when power is toggled
    if (onPowerToggle) {
      onPowerToggle(newState);
    }
  };

  const handleLowTemp = () => {
    setTemperature(24);
    
    // Your custom code here - this function will be called when low temp (24°) is selected
    if (onLowTempClick) {
      onLowTempClick();
    }
  };

  const handleHighTemp = () => {
    setTemperature(26);
    
    // Your custom code here - this function will be called when high temp (26°) is selected
    if (onHighTempClick) {
      onHighTempClick();
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <Snowflake className={`w-8 h-8 ${isOn ? 'text-blue-500' : 'text-gray-400'}`} />
          <h1>Air Conditioner</h1>
        </div>
        <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>

      {/* Temperature Display */}
      <div className="text-center mb-12">
        <div className={`text-6xl mb-2 transition-colors ${isOn ? 'text-blue-600' : 'text-gray-400'}`}>
          {temperature}°
        </div>
        <div className="text-gray-500">
          {isOn ? 'Cooling Active' : 'System Off'}
        </div>
      </div>

      {/* Temperature Preset Buttons */}
      <div className="flex gap-4 mb-12">
        <button
          onClick={handleLowTemp}
          disabled={!isOn}
          className={`flex-1 py-6 rounded-2xl transition-all ${
            isOn
              ? temperature === 24
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl mb-1">24°</div>
          <div className="text-sm">Low Temp</div>
        </button>

        <button
          onClick={handleHighTemp}
          disabled={!isOn}
          className={`flex-1 py-6 rounded-2xl transition-all ${
            isOn
              ? temperature === 26
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl mb-1">26°</div>
          <div className="text-sm">High Temp</div>
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

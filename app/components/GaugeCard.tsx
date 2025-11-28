import React from 'react';

export interface GaugeCardProps {
  title: string;
  subtitle: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  thresholds: {
    warning: number;
    danger: number;
  };
  decimals?: number;
}

export function GaugeCard({
  title,
  subtitle,
  value,
  unit,
  min,
  max,
  thresholds,
  decimals = 1,
}: GaugeCardProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const angle = (percentage / 100) * 180 - 90; // -90 to 90 degrees

  const getStatus = () => {
    if (value >= thresholds.danger) return 'danger' as const;
    if (value >= thresholds.warning) return 'warning' as const;
    return 'normal' as const;
  };

  const status = getStatus();
  const statusColors = {
    normal: { bg: 'bg-white-50', border: 'border-black-500', gauge: '#3ab13aff', text: 'text-black-700' },
    warning: { bg: 'bg-white-50', border: 'border-black-500', gauge: '#fad323ff', text: 'text-black-700' },
    danger: { bg: 'bg-white-50', border: 'border-black-500', gauge: '#c51e1eff', text: 'text-black-700' },
  };

  const colors = statusColors[status];

  return (
    <div className={`${colors.bg} rounded-xl shadow-lg p-6 border-l-4 ${colors.border} transition-all duration-300`}>
      <div className="text-center mb-4">
        <h3 className="text-blue-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>

      <div className="relative w-full aspect-square max-w-[200px] mx-auto mb-4">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="20"
            strokeLinecap="round"
          />

          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={colors.gauge}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 2.51} 251`}
            className="transition-all duration-500"
          />

          <circle cx="100" cy="100" r="50" fill="white" />

          <line
            x1="100"
            y1="100"
            x2="100"
            y2="55"
            stroke={colors.gauge}
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${angle} 100 100)`}
            className="transition-all duration-500"
          />
          <circle cx="100" cy="100" r="6" fill={colors.gauge} />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pt-8">
          <div className="text-center">
            <p className={`${colors.text}`}>{value.toFixed(decimals)}</p>
            <p className="text-xs text-gray-600 mt-1">{unit}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-500 px-2">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-2">
         
         
        </div>
      </div>
    </div>
  );
}

export default GaugeCard;


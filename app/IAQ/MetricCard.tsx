"use client";
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
  icon: ReactNode;
  color: string;
}

export function MetricCard({ title, value, unit, icon, color }: MetricCardProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl" 
           style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }}></div>
      <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-700 hover:border-slate-600 transition-all duration-300 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div className={`bg-gradient-to-br ${color} p-2.5 rounded-xl shadow-lg`}>
            <div className="text-white">
              {icon}
            </div>
          </div>
        </div>
        <p className="text-slate-400 text-sm mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-base text-slate-400">{unit}</p>
        </div>
      </div>
    </div>
  );
}
import React from 'react';

export function MetricCard({ title, value, icon: Icon, color = 'purple', subtitle = null }) {
  const colorMap = {
    purple: 'text-brand-purpleLight bg-brand-purple/10 border-brand-purple/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    cyan: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20'
  };

  const selectedColor = colorMap[color] || colorMap.purple;

  return (
    <div className="glass-card rounded-2xl p-5 border border-brand-border flex items-center justify-between">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          {title}
        </span>
        <div className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-brand-muted mt-1">{subtitle}</p>
        )}
      </div>
      {Icon && (
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${selectedColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}

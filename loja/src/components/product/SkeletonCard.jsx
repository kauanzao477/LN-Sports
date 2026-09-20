import React from 'react';

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-3 flex flex-col justify-between animate-pulse">
      <div className="w-full aspect-[4/5] rounded-xl bg-brand-surface border border-brand-border/40 mb-3" />
      <div className="space-y-2 flex-1">
        <div className="h-3 w-1/3 bg-brand-surface rounded" />
        <div className="h-4 w-5/6 bg-brand-surface rounded" />
        <div className="h-4 w-2/3 bg-brand-surface rounded" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-brand-border/40">
        <div className="h-8 bg-brand-surface rounded-xl" />
        <div className="h-8 bg-brand-surface rounded-xl" />
      </div>
    </div>
  );
}

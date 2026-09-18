import React from 'react';

export function StatusBadge({ status }) {
  const styles = {
    published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    draft: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    inactive: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  };

  const labels = {
    published: 'Publicado',
    draft: 'Rascunho',
    inactive: 'Inativo'
  };

  const currentStyle = styles[status] || styles.draft;
  const currentLabel = labels[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentStyle}`}>
      {currentLabel}
    </span>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

export function SearchBar({ placeholder = 'Buscar camisas, times, seleções...', className = '' }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/busca?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-brand-muted absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-brand-surface/90 border border-brand-border text-white placeholder-brand-muted/70 text-sm rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-colors duration-200"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-3 text-brand-muted hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  );
}

import { Search } from 'lucide-react';
import type { MasterFilters } from '../types';

export interface MasterFiltersProps {
  filters: MasterFilters;
  onChange: (filters: MasterFilters) => void;
}

export function MasterFiltersBar({ filters, onChange }: MasterFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:w-64">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar..."
          className="w-full rounded-full border border-line bg-surface py-1.5 pl-8 pr-3 text-xs text-ink outline-none focus:border-ink"
        />
      </div>
      <div className="flex rounded-full bg-mist p-1 text-xs">
        {(['all', 'active', 'inactive'] as const).map((status) => (
          <button
            key={status}
            onClick={() => onChange({ ...filters, status })}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              filters.status === status ? 'bg-surface text-ink shadow-soft' : 'text-slate hover:text-ink'
            }`}
          >
            {status === 'all' ? 'Todos' : status === 'active' ? 'Activos' : 'Inactivos'}
          </button>
        ))}
      </div>
    </div>
  );
}

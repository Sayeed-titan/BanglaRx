import React from 'react';
import { Plus, Search } from 'lucide-react';
import { Badge } from '../design-system';

interface MedicineSearchProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: any[];
  onAddMedicine: (med: any) => void;
}

/** One search row inside the Rx column. The input keeps id "medicine-search-input" (the "/" shortcut focuses it). */
export const MedicineSearch: React.FC<MedicineSearchProps> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  onAddMedicine,
}) => {
  return (
    <div className="no-print" style={{ position: 'relative' }}>
      <div className="rx-field__control" style={{ borderRadius: 'var(--rx-r-pill)' }}>
        <Search size={20} aria-hidden="true" style={{ color: 'var(--rx-ink-2)', flex: 'none' }} />
        <label htmlFor="medicine-search-input" className="rx-visually-hidden">
          Search the national formulary by brand name
        </label>
        <input
          id="medicine-search-input"
          className="rx-field__input"
          type="text"
          autoComplete="off"
          placeholder="Search medicines by brand or generic (press / to jump here)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {searchResults.length > 0 && (
        <ul className="rx-results anim-slide-up" aria-label="Matching medicines">
          {searchResults.map((med) => (
            <li key={med.id}>
              <button
                type="button"
                className="rx-result"
                onClick={() => {
                  onAddMedicine(med);
                  setSearchQuery('');
                }}
              >
                <span>
                  <span className="rx-row" style={{ gap: 8 }}>
                    <strong>{med.brand_name}</strong>
                    <Badge tone="primary">
                      {med.form} · {med.strength}
                    </Badge>
                  </span>
                  <span className="rx-result__meta">
                    {med.generic_name} · {med.manufacturer}
                  </span>
                </span>
                <span className="rx-result__add" aria-hidden="true">
                  <Plus size={18} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

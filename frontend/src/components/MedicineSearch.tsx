import React from 'react';
import { Search, Plus, Pill, Building } from 'lucide-react';

interface MedicineSearchProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: any[];
  onAddMedicine: (med: any) => void;
}

export const MedicineSearch: React.FC<MedicineSearchProps> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  onAddMedicine,
}) => {
  return (
    <div className="clinical-card" style={{ padding: '18px 22px' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'var(--teal-50)',
            color: 'var(--teal-700)',
            padding: '5px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex'
          }}>
            <Pill size={15} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--slate-900)' }}>
              National Pharmaceutical Formulary
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
              Instant directory lookup & manual append
            </p>
          </div>
        </div>

        <span className="badge-clinical badge-slate">
          DGDA Standard
        </span>
      </div>

      {/* Search Input Pod */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--slate-400)',
          display: 'flex',
          pointerEvents: 'none'
        }}>
          <Search size={16} />
        </div>

        <input
          id="medicine-search-input"
          type="text"
          placeholder="Search by brand name (e.g. Napa, Seclo, Monas, Bizoran)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-clinical"
          style={{
            paddingLeft: '36px',
            paddingRight: '14px',
            fontSize: '0.84rem'
          }}
        />

        {/* Floating Autocomplete Overlay */}
        {searchResults.length > 0 && (
          <div
            className="anim-slide-up"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: '#FFFFFF',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-float)',
              zIndex: 30,
              overflow: 'hidden',
              maxHeight: '280px',
              overflowY: 'auto'
            }}
          >
            {searchResults.map(med => (
              <div
                key={med.id}
                onClick={() => {
                  onAddMedicine(med);
                  setSearchQuery('');
                }}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--slate-100)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background var(--duration-fast) ease'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FFFFFF'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--slate-900)' }}>
                      {med.brand_name}
                    </strong>
                    <span className="badge-clinical badge-teal" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      {med.form} • {med.strength}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.74rem',
                    color: 'var(--slate-500)',
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>{med.generic_name}</span>
                    <span>•</span>
                    <span style={{ color: 'var(--slate-400)' }}>{med.manufacturer}</span>
                  </div>
                </div>

                <div style={{
                  background: 'var(--teal-50)',
                  color: 'var(--teal-700)',
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={15} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

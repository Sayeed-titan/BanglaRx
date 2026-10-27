import React from 'react';
import { Search, Plus } from 'lucide-react';

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
    <div style={{ 
      background: '#FFFFFF', 
      borderRadius: '12px', 
      padding: '16px', 
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Search size={16} color="#0F52BA" />
        <h3 style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1E293B' }}>
          Add Medicine (PostgreSQL Inventory Lookup)
        </h3>
      </div>
      
      <div style={{ position: 'relative' }}>
        <input 
          type="text" 
          placeholder="Type brand name (e.g. Napa, Seclo, Monas, Fexo)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px 12px', 
            borderRadius: '6px', 
            border: '1px solid #CBD5E1',
            fontSize: '0.82rem'
          }}
        />

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            background: '#FFFFFF', 
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 20,
            marginTop: '4px',
            overflow: 'hidden'
          }}>
            {searchResults.map(med => (
              <div 
                key={med.id} 
                onClick={() => onAddMedicine(med)}
                style={{ 
                  padding: '8px 12px', 
                  borderBottom: '1px solid #F1F5F9',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
              >
                <div>
                  <strong>{med.brand_name}</strong> <span style={{ color: '#64748B' }}>({med.form} - {med.strength})</span>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{med.generic_name} • {med.manufacturer}</div>
                </div>
                <Plus size={16} color="#0F52BA" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

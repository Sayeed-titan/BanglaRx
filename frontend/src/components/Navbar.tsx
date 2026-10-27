import React from 'react';
import { Stethoscope, Cpu, QrCode, Building2, User, Printer, CheckCircle2 } from 'lucide-react';
import type { Doctor, Patient } from '../types/index';

interface NavbarProps {
  doctors: Doctor[];
  patients: Patient[];
  selectedDoctor: Doctor | null;
  selectedPatient: Patient | null;
  setSelectedDoctor: (doc: Doctor) => void;
  setSelectedPatient: (pat: Patient) => void;
  onOpenQrModal: () => void;
  onSavePrescription: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  doctors,
  patients,
  selectedDoctor,
  selectedPatient,
  setSelectedDoctor,
  setSelectedPatient,
  onOpenQrModal,
  onSavePrescription,
  isSaving,
  saveSuccess,
}) => {
  return (
    <>
      {/* TOP HEADER */}
      <header className="no-print" style={{ 
        background: '#0F52BA', 
        color: '#FFFFFF', 
        padding: '12px 24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.15)', 
            padding: '8px', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Stethoscope size={26} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                BanglaRx AI™
              </h1>
              <span style={{ 
                fontSize: '0.7rem', 
                background: '#00A86B', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontWeight: '700'
              }}>
                R&D FAIR EDITION
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', opacity: 0.85 }}>
              Ambient Clinical Intelligence & Smart Prescription Guardian (DCCI AI Fair)
            </p>
          </div>
        </div>

        {/* Badges & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(255,255,255,0.18)', 
            padding: '6px 14px', 
            borderRadius: '20px',
            fontSize: '0.8rem',
            border: '1px solid rgba(255,255,255,0.25)'
          }}>
            <Cpu size={15} color="#67E8F9" />
            <span>AI: <strong>Gemini 3.5 Flash Neural Engine</strong></span>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'rgba(255,255,255,0.12)', 
            padding: '6px 12px', 
            borderRadius: '20px',
            fontSize: '0.78rem'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#10B981',
              display: 'inline-block' 
            }} />
            <span>PostgreSQL 18: <strong>BanglaRxDB</strong></span>
          </div>

          <button 
            onClick={onOpenQrModal}
            style={{ 
              background: '#FFFFFF', 
              color: '#0F52BA', 
              border: 'none', 
              padding: '7px 16px', 
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <QrCode size={16} /> Patient Mobile View
          </button>
        </div>
      </header>

      {/* DOCTOR & PATIENT SELECTION SUB-BAR */}
      <div className="no-print" style={{ 
        background: '#FFFFFF', 
        borderBottom: '1px solid #E2E8F0', 
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="#0F52BA" />
            <span style={{ color: '#64748B', fontWeight: '500' }}>Physician:</span>
            <select 
              value={selectedDoctor?.id || ''} 
              onChange={e => {
                const doc = doctors.find(d => d.id === parseInt(e.target.value));
                if (doc) setSelectedDoctor(doc);
              }}
              style={{ 
                padding: '4px 8px', 
                borderRadius: '6px', 
                border: '1px solid #CBD5E1',
                fontWeight: '600',
                color: '#1E293B',
                background: '#F8FAFC'
              }}
            >
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="#00A86B" />
            <span style={{ color: '#64748B', fontWeight: '500' }}>Patient:</span>
            <select 
              value={selectedPatient?.id || ''} 
              onChange={e => {
                const pat = patients.find(p => p.id === parseInt(e.target.value));
                if (pat) setSelectedPatient(pat);
              }}
              style={{ 
                padding: '4px 8px', 
                borderRadius: '6px', 
                border: '1px solid #CBD5E1',
                fontWeight: '600',
                color: '#1E293B',
                background: '#F8FAFC'
              }}
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.age}y/{p.gender[0]}) — {p.patient_uid}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => window.print()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 14px', 
              borderRadius: '6px', 
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              fontWeight: '600',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            <Printer size={15} /> Print Rx Pad
          </button>

          <button 
            onClick={onSavePrescription}
            disabled={isSaving}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 16px', 
              borderRadius: '6px', 
              border: 'none',
              background: saveSuccess ? '#00A86B' : '#0F52BA',
              color: '#FFFFFF',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <CheckCircle2 size={15} />
            {saveSuccess ? 'Signed & Stored!' : isSaving ? 'Saving...' : 'Sign & Save Rx'}
          </button>
        </div>
      </div>
    </>
  );
};

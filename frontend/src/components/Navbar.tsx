import React from 'react';
import { Stethoscope, ShieldCheck, QrCode, CheckCircle2, User, Building2, Sparkles } from 'lucide-react';
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
    <header className="no-print" style={{
      background: 'var(--slate-900)',
      color: '#FFFFFF',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: 'var(--shadow-card)'
    }}>
      {/* Primary Navigation Row */}
      <div style={{
        maxWidth: '1680px',
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Brand & System Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--teal-600) 0%, var(--teal-700) 100%)',
            color: '#FFFFFF',
            padding: '9px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)'
          }}>
            <Stethoscope size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '1.2rem',
                fontWeight: '800',
                letterSpacing: '-0.02em',
                color: '#FFFFFF'
              }}>
                BanglaRx AI<sup style={{ fontSize: '0.65rem', color: 'var(--teal-400)', marginLeft: '1px' }}>™</sup>
              </span>
              <span className="badge-clinical badge-teal" style={{
                background: 'rgba(13, 148, 136, 0.2)',
                color: 'var(--teal-300)',
                border: '1px solid rgba(13, 148, 136, 0.35)'
              }}>
                CLINICAL SUITE
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--slate-400)', marginTop: '1px' }}>
              Ambient Clinical Intelligence & Smart Prescription Guardian
            </p>
          </div>
        </div>

        {/* System Telemetry & White-labeled Engine Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Intelligence Engine Status Pill (White-labeled) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.76rem'
          }}>
            <Sparkles size={13} color="var(--teal-400)" />
            <span style={{ color: 'var(--slate-300)' }}>
              Intelligence: <strong style={{ color: '#FFFFFF', fontWeight: '600' }}>BanglaRx Neural Core</strong>
            </span>
          </div>

          {/* Database Health Pill (White-labeled) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.76rem'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: 'var(--emerald-500)',
              display: 'inline-block',
              boxShadow: '0 0 6px var(--emerald-500)'
            }} />
            <span style={{ color: 'var(--slate-300)' }}>
              Formulary Vault: <strong style={{ color: '#FFFFFF', fontWeight: '600' }}>Synchronized</strong>
            </span>
          </div>

          {/* Patient Mobile Passport Button */}
          <button
            onClick={onOpenQrModal}
            className="btn-clinical"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '0.78rem',
              padding: '7px 14px'
            }}
          >
            <QrCode size={15} />
            <span>Patient Mobile View</span>
          </button>

          {/* Save / Finalize Prescription Button */}
          <button
            onClick={onSavePrescription}
            disabled={isSaving}
            className="btn-clinical btn-primary-teal"
            style={{
              fontSize: '0.78rem',
              padding: '7px 16px'
            }}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={15} />
                <span>Signed & Dispatched</span>
              </>
            ) : isSaving ? (
              <span>Validating...</span>
            ) : (
              <>
                <ShieldCheck size={15} />
                <span>Sign & Save Rx</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Secondary Doctor & Patient Selector Bar */}
      <div style={{
        background: 'rgba(2, 6, 23, 0.55)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '8px 24px'
      }}>
        <div style={{
          maxWidth: '1680px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.78rem'
        }}>
          {/* Active Doctor Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={14} color="var(--teal-400)" />
            <span style={{ color: 'var(--slate-400)' }}>Prescribing Physician:</span>
            <select
              value={selectedDoctor?.id || ''}
              onChange={e => {
                const doc = doctors.find(d => d.id === Number(e.target.value));
                if (doc) setSelectedDoctor(doc);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.76rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {doctors.map(d => (
                <option key={d.id} value={d.id} style={{ background: 'var(--slate-900)', color: '#FFFFFF' }}>
                  {d.name} — {d.specialization} ({d.hospital_name})
                </option>
              ))}
            </select>
          </div>

          {/* Active Patient Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={14} color="var(--sapphire-400)" />
            <span style={{ color: 'var(--slate-400)' }}>Active Consultation:</span>
            <select
              value={selectedPatient?.id || ''}
              onChange={e => {
                const pat = patients.find(p => p.id === Number(e.target.value));
                if (pat) setSelectedPatient(pat);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.76rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {patients.map(p => (
                <option key={p.id} value={p.id} style={{ background: 'var(--slate-900)', color: '#FFFFFF' }}>
                  {p.full_name} ({p.age}Y, {p.gender}) — {p.chronic_conditions || 'Routine Visit'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

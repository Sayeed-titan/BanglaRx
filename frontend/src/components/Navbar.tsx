import React from 'react';
import { Stethoscope, ShieldCheck, QrCode, CheckCircle2, User, Building2, Sparkles, Users, UserPlus, Settings } from 'lucide-react';
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
  queueCount: number;
  waitingCount: number;
  onOpenQueue: () => void;
  onOpenPatientRegistration: () => void;
  onOpenDoctorProfile: () => void;
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
  queueCount,
  waitingCount,
  onOpenQueue,
  onOpenPatientRegistration,
  onOpenDoctorProfile,
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

        {/* System Telemetry & Quick Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Today's Queue Drawer Launcher */}
          <button
            type="button"
            onClick={onOpenQueue}
            className="btn-clinical"
            style={{
              background: waitingCount > 0 ? 'rgba(217, 119, 6, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              color: waitingCount > 0 ? '#FCD34D' : '#FFFFFF',
              border: waitingCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: '0.78rem',
              padding: '7px 14px'
            }}
            title="Open Today's Patient Queue"
          >
            <Users size={15} />
            <span>Chamber Queue: <strong>{queueCount} Total</strong> ({waitingCount} Waiting)</span>
          </button>

          {/* New Patient Registration Button */}
          <button
            type="button"
            onClick={onOpenPatientRegistration}
            className="btn-clinical"
            style={{
              background: 'rgba(13, 148, 136, 0.25)',
              color: 'var(--teal-300)',
              border: '1px solid rgba(13, 148, 136, 0.45)',
              fontSize: '0.78rem',
              padding: '7px 14px'
            }}
            title="Register Walk-in Patient & Issue Token"
          >
            <UserPlus size={15} />
            <span>+ New Patient</span>
          </button>

          {/* Patient Mobile Passport Button */}
          <button
            type="button"
            onClick={onOpenQrModal}
            className="btn-clinical"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: '0.78rem',
              padding: '7px 14px'
            }}
            title="Open Patient Mobile View & QR Code"
          >
            <QrCode size={15} />
            <span>QR View</span>
          </button>

          {/* Save / Finalize Prescription Button */}
          <button
            type="button"
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
          {/* Active Doctor Selector & Profile Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={14} color="var(--teal-400)" />
            <span style={{ color: 'var(--slate-400)' }}>Doctor & Chamber:</span>
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

            {/* Doctor Profile Edit Button */}
            <button
              type="button"
              onClick={onOpenDoctorProfile}
              className="btn-clinical"
              style={{
                background: 'transparent',
                color: 'var(--slate-300)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '3px 8px',
                fontSize: '0.72rem',
                borderRadius: 'var(--radius-sm)'
              }}
              title="Chamber setup & doctor credentials"
            >
              <Settings size={12} />
              <span>Chamber & Doctor Setup</span>
            </button>
          </div>

          {/* Active Patient Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={14} color="var(--sapphire-400)" />
            <span style={{ color: 'var(--slate-400)' }}>In Consultation:</span>
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

import React from 'react';
import { X, Users, Play, CheckCircle2, Clock, UserPlus, HeartPulse, ArrowRight } from 'lucide-react';
import type { QueueItem } from '../types/index';

interface ChamberQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: QueueItem[];
  activePatientId: number | null;
  onSelectPatientFromQueue: (item: QueueItem) => void;
  onOpenPatientRegistration: () => void;
  onCallNextPatient: () => void;
}

export const ChamberQueueDrawer: React.FC<ChamberQueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  activePatientId,
  onSelectPatientFromQueue,
  onOpenPatientRegistration,
  onCallNextPatient,
}) => {
  if (!isOpen) return null;

  const waitingCount = queue.filter(q => q.status === 'Waiting').length;
  const inConsultCount = queue.filter(q => q.status === 'In Consultation').length;
  const completedCount = queue.filter(q => q.status === 'Completed').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 90
      }}
      onClick={onClose}
    >
      <div
        className="anim-slide-up"
        style={{
          background: '#FFFFFF',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--slate-200)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--slate-50)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--teal-50)',
              color: 'var(--teal-700)',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              display: 'flex'
            }}>
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                Today's Patient Chamber Queue
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                Live OPD waiting room & serial dispatch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-clinical btn-outline"
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Status Pill Bar */}
        <div style={{
          padding: '12px 22px',
          background: 'var(--slate-100)',
          borderBottom: '1px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge-clinical badge-teal">
              {inConsultCount} In Chamber
            </span>
            <span className="badge-clinical badge-amber">
              {waitingCount} Waiting
            </span>
            <span className="badge-clinical badge-emerald">
              {completedCount} Completed
            </span>
          </div>

          {/* Register Patient Button */}
          <button
            type="button"
            onClick={onOpenPatientRegistration}
            className="btn-clinical btn-primary-teal"
            style={{ padding: '5px 10px', fontSize: '0.72rem' }}
          >
            <UserPlus size={13} />
            <span>+ New Patient</span>
          </button>
        </div>

        {/* 1-Click Call Next Patient Action Card */}
        {waitingCount > 0 && (
          <div style={{
            padding: '12px 22px',
            background: 'var(--teal-50)',
            borderBottom: '1px solid var(--teal-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--teal-900)' }}>
                Ready for next consultation?
              </span>
              <p style={{ fontSize: '0.72rem', color: 'var(--teal-700)' }}>
                Signs current prescription & calls the next patient.
              </p>
            </div>

            <button
              type="button"
              onClick={onCallNextPatient}
              className="btn-clinical btn-primary-teal"
              style={{ padding: '7px 14px', fontSize: '0.76rem' }}
            >
              <span>Call Next Patient</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Queue Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {queue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>
              <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.86rem', fontWeight: '600' }}>No patients in today's queue</p>
              <p style={{ fontSize: '0.76rem', marginTop: '4px' }}>Click "+ New Patient" to register a patient.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {queue.map(item => {
                const isActive = item.patient_id === activePatientId;
                const vitals = typeof item.triage_vitals === 'string' 
                  ? JSON.parse(item.triage_vitals || '{}') 
                  : item.triage_vitals || {};

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-lg)',
                      background: isActive ? '#FFFFFF' : 'var(--slate-50)',
                      border: isActive ? '2px solid var(--teal-600)' : '1px solid var(--slate-200)',
                      boxShadow: isActive ? 'var(--shadow-card)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Top Row: Serial Token, Patient Name & Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: isActive ? 'var(--teal-600)' : 'var(--slate-800)',
                          color: '#FFFFFF',
                          fontWeight: '800',
                          fontSize: '0.76rem',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          #{item.token_number}
                        </span>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--slate-900)' }}>
                          {item.patient_name}
                        </strong>
                        <span style={{ fontSize: '0.76rem', color: 'var(--slate-500)' }}>
                          ({item.patient_age}Y, {item.patient_gender})
                        </span>
                      </div>

                      {item.status === 'In Consultation' ? (
                        <span className="badge-clinical badge-teal" style={{ animation: 'pulse-soft 2s infinite' }}>
                          ● In Chamber
                        </span>
                      ) : item.status === 'Completed' ? (
                        <span className="badge-clinical badge-emerald">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      ) : (
                        <span className="badge-clinical badge-amber">
                          <Clock size={12} /> Waiting
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Complaint & Demographics */}
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--slate-600)' }}>
                      <strong>Complaint:</strong> {item.chief_complaint || 'General Checkup'}
                    </div>

                    {/* Pre-checked Triage Vitals */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '8px',
                      fontSize: '0.72rem',
                      color: 'var(--slate-500)',
                      flexWrap: 'wrap'
                    }}>
                      {vitals.bp && <span>BP: <strong style={{ color: 'var(--slate-800)' }}>{vitals.bp}</strong></span>}
                      {vitals.temp && <span>Temp: <strong style={{ color: 'var(--crimson-700)' }}>{vitals.temp}</strong></span>}
                      {vitals.pulse && <span>Pulse: <strong style={{ color: 'var(--slate-800)' }}>{vitals.pulse}</strong></span>}
                      {item.patient_blood_group && <span>Blood: <strong style={{ color: 'var(--slate-800)' }}>{item.patient_blood_group}</strong></span>}
                    </div>

                    {/* Bottom Action Row */}
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--slate-200)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
                        ID: {item.patient_uid}
                      </span>

                      {isActive ? (
                        <span style={{ fontSize: '0.74rem', color: 'var(--teal-700)', fontWeight: '700' }}>
                          ✓ Active in Consultation Pad
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectPatientFromQueue(item);
                            onClose();
                          }}
                          className="btn-clinical btn-outline"
                          style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                        >
                          <Play size={12} />
                          <span>Call into Chamber</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

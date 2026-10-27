import React from 'react';
import { X, Layers, ShieldCheck, Database, Cpu, Activity, Stethoscope } from 'lucide-react';

interface StackInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StackInfoModal: React.FC<StackInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        className="anim-scale-in"
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '560px',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--slate-200)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
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
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                System Architecture & Technical Specifications
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--slate-500)' }}>
                BanglaRx AI™ Ambient Clinical Infrastructure
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-clinical btn-outline"
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          
          {/* Architecture Pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Pillar 1 */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--teal-50)',
                color: 'var(--teal-700)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                marginTop: '2px',
                display: 'flex'
              }}>
                <Cpu size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                  Ambient Clinical Intelligence Layer
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '2px', lineHeight: 1.5 }}>
                  Proprietary multimodal neural orchestration pipeline with deterministic JSON schema enforcement. Processes unscripted bilingual speech (Bangla, English, Banglish) with sub-2s latency.
                </p>
              </div>
            </div>

            {/* Pillar 2 */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--sapphire-50)',
                color: 'var(--sapphire-700)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                marginTop: '2px',
                display: 'flex'
              }}>
                <Database size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                  Enterprise Clinical Knowledge Vault
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '2px', lineHeight: 1.5 }}>
                  High-performance relational persistence engine with Trigram fuzzy similarity indexing. Grounds every entity against certified DGDA pharmaceutical brands and official generics.
                </p>
              </div>
            </div>

            {/* Pillar 3 */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--crimson-50)',
                color: 'var(--crimson-700)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                marginTop: '2px',
                display: 'flex'
              }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                  Drug-Drug Interaction (DDI) Safety Interceptor
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '2px', lineHeight: 1.5 }}>
                  Pre-emptive clinical rules evaluator executing pharmacokinetic and pharmacodynamic conflict checks prior to prescription signing.
                </p>
              </div>
            </div>

            {/* Pillar 4 */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--emerald-50)',
                color: 'var(--emerald-700)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                marginTop: '2px',
                display: 'flex'
              }}>
                <Activity size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                  Accessibility & Patient Mobile Gateway
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '2px', lineHeight: 1.5 }}>
                  Dynamic cryptographic QR code packaging paired with client-side Bengali acoustic synthesis (Text-to-Speech) for complete patient adherence.
                </p>
              </div>
            </div>

          </div>

          {/* System Environment Grid */}
          <div style={{
            marginTop: '20px',
            background: 'var(--slate-50)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            border: '1px solid var(--slate-200)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            fontSize: '0.74rem'
          }}>
            <div>
              <span style={{ color: 'var(--slate-500)' }}>Runtime Environment:</span>
              <div style={{ fontWeight: '700', color: 'var(--slate-800)' }}>Asynchronous Minimal Core API</div>
            </div>
            <div>
              <span style={{ color: 'var(--slate-500)' }}>Client Layer:</span>
              <div style={{ fontWeight: '700', color: 'var(--slate-800)' }}>React 19 + TypeScript + Vite</div>
            </div>
            <div>
              <span style={{ color: 'var(--slate-500)' }}>Clinical Compliance:</span>
              <div style={{ fontWeight: '700', color: 'var(--slate-800)' }}>BMDC Prescribing Guidelines</div>
            </div>
            <div>
              <span style={{ color: 'var(--slate-500)' }}>Security Architecture:</span>
              <div style={{ fontWeight: '700', color: 'var(--slate-800)' }}>Doctor-in-the-Loop Isolation</div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--slate-100)',
          borderTop: '1px solid var(--slate-200)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button 
            onClick={onClose}
            className="btn-clinical btn-primary-slate"
            style={{ fontSize: '0.8rem', padding: '8px 16px' }}
          >
            Close Overview
          </button>
        </div>

      </div>
    </div>
  );
};

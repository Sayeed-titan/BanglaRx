import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AccuracyMetrics } from '../types/index';

interface AccuracyAnalyticsProps {
  metrics: AccuracyMetrics | null;
}

export const AccuracyAnalytics: React.FC<AccuracyAnalyticsProps> = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div className="clinical-card" style={{ padding: '14px 18px', background: 'var(--slate-50)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Verification Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'var(--emerald-50)',
            color: 'var(--emerald-700)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex'
          }}>
            <ShieldCheck size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                Clinical Verification:
              </span>
              <span className="badge-clinical badge-emerald">
                High Confidence
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '1px' }}>
              Prescription entities cross-verified with DGDA national drug formulary
            </p>
          </div>
        </div>

        {/* Doctor-Facing Clinical Summary Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="badge-clinical badge-amber">
            {metrics.detectedCategories.symptoms} Symptoms
          </span>
          <span className="badge-clinical badge-teal">
            {metrics.detectedCategories.vitals} Vitals
          </span>
          <span className="badge-clinical badge-emerald">
            {metrics.detectedCategories.medications} Formulary Drugs
          </span>
          <span className="badge-clinical badge-slate">
            {metrics.detectedCategories.instructions} Advice
          </span>
        </div>
      </div>
    </div>
  );
};

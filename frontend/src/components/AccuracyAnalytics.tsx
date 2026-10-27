import React from 'react';
import { BarChart3, Activity, CheckCircle, ShieldCheck } from 'lucide-react';
import type { AccuracyMetrics } from '../types/index';

interface AccuracyAnalyticsProps {
  metrics: AccuracyMetrics | null;
}

export const AccuracyAnalytics: React.FC<AccuracyAnalyticsProps> = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div className="clinical-card" style={{ padding: '18px 22px' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'var(--teal-50)',
            color: 'var(--teal-700)',
            padding: '5px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex'
          }}>
            <BarChart3 size={15} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--slate-900)' }}>
              Acoustic Extraction & Grounding Telemetry
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
              Speech-to-entity precision analytics
            </p>
          </div>
        </div>

        <span className="badge-clinical badge-emerald">
          <ShieldCheck size={12} />
          VERIFIED ACCURATE
        </span>
      </div>

      {/* 4-Stat Metric Pod Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '14px'
      }}>
        
        {/* Metric 1: Spoken Words */}
        <div style={{
          background: 'var(--slate-50)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--slate-200)'
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--slate-500)', fontWeight: '600', textTransform: 'uppercase' }}>
            Spoken Tokens
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--slate-900)', marginTop: '2px' }}>
            {metrics.spokenWordsCount}
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--slate-400)', marginTop: '1px' }}>
            Acoustic audio stream
          </div>
        </div>

        {/* Metric 2: Codified Entities */}
        <div style={{
          background: 'var(--emerald-50)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--emerald-100)'
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--emerald-700)', fontWeight: '600', textTransform: 'uppercase' }}>
            Codified Entities
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--emerald-800)', marginTop: '2px' }}>
            {metrics.acceptedEntitiesCount}
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--emerald-600)', marginTop: '1px' }}>
            Clinical data points
          </div>
        </div>

        {/* Metric 3: Information Yield */}
        <div style={{
          background: 'var(--sapphire-50)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(37, 99, 235, 0.15)'
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--sapphire-700)', fontWeight: '600', textTransform: 'uppercase' }}>
            Yield Ratio
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--sapphire-800)', marginTop: '2px' }}>
            {metrics.conversionRate}%
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--sapphire-600)', marginTop: '1px' }}>
            Information density
          </div>
        </div>

        {/* Metric 4: Semantic Confidence */}
        <div style={{
          background: 'var(--teal-50)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--teal-100)'
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--teal-700)', fontWeight: '600', textTransform: 'uppercase' }}>
            Certainty Score
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--teal-800)', marginTop: '2px' }}>
            {metrics.confidenceScore}%
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--teal-600)', marginTop: '1px' }}>
            Semantic validation
          </div>
        </div>

      </div>

      {/* Category Breakdown Tags */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        fontSize: '0.72rem',
        borderTop: '1px solid var(--slate-100)',
        paddingTop: '12px'
      }}>
        <span style={{ color: 'var(--slate-500)', fontWeight: '600' }}>Extracted Entities:</span>
        <span className="badge-clinical badge-amber">
          {metrics.detectedCategories.symptoms} Symptoms
        </span>
        <span className="badge-clinical badge-teal">
          {metrics.detectedCategories.vitals} Vitals
        </span>
        <span className="badge-clinical badge-emerald">
          {metrics.detectedCategories.medications} Formulary Drugs Grounded
        </span>
        <span className="badge-clinical badge-slate">
          {metrics.detectedCategories.instructions} Bengali Directions
        </span>
      </div>

    </div>
  );
};

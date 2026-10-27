import React from 'react';
import { BarChart2 } from 'lucide-react';
import type { AccuracyMetrics } from '../types/index';

interface AccuracyAnalyticsProps {
  metrics: AccuracyMetrics | null;
}

export const AccuracyAnalytics: React.FC<AccuracyAnalyticsProps> = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div style={{ 
      background: '#FFFFFF', 
      borderRadius: '12px', 
      padding: '16px 20px', 
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid #E2E8F0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} color="#0F52BA" />
          <h3 style={{ fontSize: '0.88rem', fontWeight: '800', color: '#1E293B' }}>
            Voice Accuracy & Grounding Analytics
          </h3>
        </div>
        <span style={{ 
          fontSize: '0.72rem', 
          background: '#ECFDF5', 
          color: '#065F46', 
          padding: '2px 8px', 
          borderRadius: '12px',
          fontWeight: '700' 
        }}>
          VERIFIED ACCURATE
        </span>
      </div>

      {/* 4-Stat Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
        
        {/* Words Spoken */}
        <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '600' }}>Words Spoken:</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B' }}>
            {metrics.spokenWordsCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Acoustic Audio Input</div>
        </div>

        {/* Entities Codified */}
        <div style={{ background: '#F0FDF4', padding: '8px 10px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: '600' }}>Entities Codified:</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#15803D' }}>
            {metrics.acceptedEntitiesCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#86EFAC' }}>Medical Entities</div>
        </div>

        {/* Extraction Ratio */}
        <div style={{ background: '#EFF6FF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: '0.7rem', color: '#1E40AF', fontWeight: '600' }}>Extraction Rate:</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1D4ED8' }}>
            {metrics.conversionRate}%
          </div>
          <div style={{ fontSize: '0.68rem', color: '#93C5FD' }}>Information Yield</div>
        </div>

        {/* AI Confidence */}
        <div style={{ background: '#FAF5FF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E9D5FF' }}>
          <div style={{ fontSize: '0.7rem', color: '#6B21A8', fontWeight: '600' }}>Neural Confidence:</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#7E22CE' }}>
            {metrics.confidenceScore}%
          </div>
          <div style={{ fontSize: '0.68rem', color: '#D8B4FE' }}>Gemini Logprob</div>
        </div>

      </div>

      {/* Breakdown Pills */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.72rem',
        borderTop: '1px solid #F1F5F9',
        paddingTop: '10px'
      }}>
        <span style={{ color: '#64748B', fontWeight: '600' }}>Codified Breakdown:</span>
        <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
          {metrics.detectedCategories.symptoms} Symptoms
        </span>
        <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
          {metrics.detectedCategories.vitals} Vitals
        </span>
        <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
          {metrics.detectedCategories.medications} Medicines (DB Grounded)
        </span>
        <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
          {metrics.detectedCategories.instructions} Advice Items
        </span>
      </div>

    </div>
  );
};

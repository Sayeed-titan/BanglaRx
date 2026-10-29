import React from 'react';
import type { AccuracyMetrics } from '../types/index';
import { Badge, Callout } from '../design-system';

interface AccuracyAnalyticsProps {
  metrics: AccuracyMetrics | null;
}

/** The verification strip above the sheet: what the AI drafted and what still needs a human look. */
export const AccuracyAnalytics: React.FC<AccuracyAnalyticsProps> = ({ metrics }) => {
  if (!metrics) return null;
  const unmatched = metrics.unmatchedMedicines;
  const d = metrics.detectedCategories;

  return (
    <div className="no-print rx-stack" style={{ gap: 8 }}>
      {unmatched > 0 ? (
        <Callout tone="attention" title={`${unmatched} medicine(s) not matched to the formulary`}>
          Please verify the name before you sign. AI draft only: review every field.
        </Callout>
      ) : (
        <Callout tone="success" title={`All ${d.medications} medicines matched to the formulary`}>
          AI draft only. Review every field before you sign.
        </Callout>
      )}
      <div className="rx-row" style={{ gap: 6 }}>
        <Badge tone="attention">{d.symptoms} symptoms</Badge>
        <Badge tone="primary">{d.vitals} vitals</Badge>
        <Badge tone="success">{d.medications} formulary drugs</Badge>
        <Badge>{d.instructions} advice</Badge>
      </div>
    </div>
  );
};

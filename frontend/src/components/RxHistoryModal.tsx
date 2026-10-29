import React, { useEffect, useState } from 'react';
import { Badge, Callout, Modal } from '../design-system';
import { getJson } from '../api';

interface Earlier {
  version: number;
  replacedAt: string;
  diagnosis?: string;
  followUp?: string;
  medicines: Array<{ brandName?: string; dosagePattern?: string; duration?: string }>;
}
interface History {
  rxNumber: string;
  currentVersion: number;
  savedAt: string;
  lastChangedAt?: string;
  earlier: Earlier[];
}

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Every earlier version of a signed prescription, as it was before each change. */
export const RxHistoryModal: React.FC<{ open: boolean; onClose: () => void; rxId: number | null }> = ({ open, onClose, rxId }) => {
  const [h, setH] = useState<History | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !rxId) return;
    setH(null);
    setError(false);
    getJson<History>(`/prescriptions/${rxId}/history`).then(setH).catch(() => setError(true));
  }, [open, rxId]);

  return (
    <Modal open={open} onClose={onClose} title="Prescription history" subtitle={h ? `${h.rxNumber} · now version ${h.currentVersion}` : undefined} size="md">
      {error && <Callout tone="danger">Could not load the history. Check the connection and try again.</Callout>}
      {!error && !h && <span>Loading…</span>}
      {h && (
        <div className="rx-stack" style={{ gap: 12 }}>
          <div className="rx-row" style={{ gap: 8 }}>
            <Badge tone="primary">Version {h.currentVersion} (current)</Badge>
            <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
              {h.lastChangedAt ? `Last changed ${when(h.lastChangedAt)}` : `Signed ${when(h.savedAt)}`}
            </span>
          </div>
          {h.earlier.length === 0 && <span>This prescription has not been changed since it was signed.</span>}
          {h.earlier.slice().reverse().map((e) => (
            <div key={e.version} className="rx-stack" style={{ gap: 4, padding: 12, border: '1px solid var(--rx-outline)', borderRadius: 14 }}>
              <div className="rx-row" style={{ justifyContent: 'space-between' }}>
                <strong>Version {e.version}</strong>
                <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Replaced {when(e.replacedAt)}</span>
              </div>
              <span>Diagnosis: {e.diagnosis || 'Not stated'}</span>
              <span>
                Medicines:{' '}
                {e.medicines.length === 0
                  ? 'none'
                  : e.medicines.map((m) => `${m.brandName || '(name not kept)'}${m.dosagePattern ? ` ${m.dosagePattern}` : ''}${m.duration ? `, ${m.duration}` : ''}`).join('; ')}
              </span>
              {e.followUp && <span>Follow-up: {e.followUp}</span>}
            </div>
          ))}
          <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Earlier versions are kept for the record and cannot be edited.</span>
        </div>
      )}
    </Modal>
  );
};

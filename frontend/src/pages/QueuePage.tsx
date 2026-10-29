import React from 'react';
import { ArrowRight, CalendarCheck, Play, UserPlus, Users } from 'lucide-react';
import type { Doctor, QueueItem } from '../types/index';
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader, QueueCard, StatTile } from '../design-system';

interface QueuePageProps {
  doctor: Doctor | null;
  queue: QueueItem[];
  activePatientId: number | null;
  onSelectPatientFromQueue: (item: QueueItem) => void;
  onCallNextPatient: () => void;
}

const ORDER = { 'In Consultation': 0, Waiting: 1, Completed: 2 } as const;

/** Today's chamber queue as a page: counts, call next, and the full list. */
export const QueuePage: React.FC<QueuePageProps> = ({ doctor, queue, activePatientId, onSelectPatientFromQueue, onCallNextPatient }) => {
  const waiting = queue.filter((q) => q.status === 'Waiting');
  const inChamber = queue.filter((q) => q.status === 'In Consultation');
  const completed = queue.filter((q) => q.status === 'Completed');
  const next = waiting.slice().sort((a, b) => a.token_number - b.token_number)[0];
  const goToPad = () => {
    window.location.hash = '#/';
  };
  const sorted = queue.slice().sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.token_number - b.token_number);

  return (
    <div className="rx-page">
      <PageHeader
        title="Today's chamber queue"
        subtitle={`${doctor?.name ?? 'No doctor'}${doctor?.room_no ? ` · ${doctor.room_no}` : ''} · ${new Date().toLocaleDateString('en-GB')}`}
        backHref="#/"
        backLabel="Back to the workbench"
        live
        actions={
          <>
            <LinkButton href="#/bookings" variant="outlined" icon={<CalendarCheck size={18} />}>
              Bookings
            </LinkButton>
            <LinkButton href="#/register" icon={<UserPlus size={18} />}>
              New patient
            </LinkButton>
          </>
        }
      />

      <main className="rx-split">
        <div className="rx-split__main">
          <div className="rx-stats">
            <StatTile tone="primary" label="In chamber" value={inChamber.length} />
            <StatTile tone="attention" label="Waiting" value={waiting.length} />
            <StatTile label="Seen today" value={completed.length} />
          </div>

          {next ? (
            <div className="rx-callrow">
              <div>
                <strong style={{ fontSize: 17 }}>Ready for the next patient?</strong>
                <div style={{ fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)' }}>
                  Finishes the current visit and calls token {next.token_number}, {next.patient_name}.
                </div>
              </div>
              <Button
                size="lg"
                icon={<ArrowRight size={20} />}
                onClick={() => {
                  onCallNextPatient();
                  goToPad();
                }}
              >
                Call next
              </Button>
            </div>
          ) : (
            queue.length > 0 && (
              <div className="rx-callrow" style={{ borderColor: 'transparent', background: 'var(--rx-success)', color: 'var(--rx-on-success)' }}>
                <span>
                  <strong>Queue is clear.</strong> Everyone who arrived has been seen.
                </span>
              </div>
            )
          )}

          {queue.length === 0 ? (
            <Card>
              <EmptyState icon={<Users size={36} />} title="No patients in today's queue">
                Choose New patient to register one and issue a token.
              </EmptyState>
            </Card>
          ) : (
            <ul className="rx-queuelist" aria-label="Patients today">
              {sorted.map((item) => {
                const raw = typeof item.triage_vitals === 'string' ? JSON.parse(item.triage_vitals || '{}') : item.triage_vitals || {};
                const vitals: Array<{ label: string; value: string; hot?: boolean }> = [];
                if (raw.bp) vitals.push({ label: 'BP', value: raw.bp });
                if (raw.temp) vitals.push({ label: 'Temp', value: raw.temp, hot: parseFloat(raw.temp) >= 100 });
                if (raw.pulse) vitals.push({ label: 'Pulse', value: raw.pulse });
                if (raw.spo2) vitals.push({ label: 'SpO₂', value: raw.spo2 });
                return (
                  <li key={item.id}>
                    <QueueCard
                      token={item.token_number}
                      name={item.patient_name}
                      meta={`${item.patient_age}Y, ${item.patient_gender}`}
                      status={item.status}
                      complaint={item.chief_complaint}
                      vitals={vitals}
                      uid={item.patient_uid}
                      active={item.patient_id === activePatientId && item.status !== 'Completed'}
                      action={
                        item.status === 'Completed' ? undefined : (
                          <Button
                            variant="outlined"
                            icon={<Play size={16} />}
                            onClick={() => {
                              onSelectPatientFromQueue(item);
                              goToPad();
                            }}
                          >
                            Call into chamber
                          </Button>
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="rx-split__side" aria-label="What patients see">
          <Card>
            <div className="rx-stack" style={{ gap: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>What patients see</h2>
              <div style={{ padding: '14px 16px', borderRadius: 'var(--rx-r-md)', background: 'var(--rx-bg)' }}>
                <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Doctor status</div>
                <Badge tone={inChamber.length > 0 ? 'success' : 'neutral'}>{inChamber.length > 0 ? 'In chamber' : 'Between patients'}</Badge>
              </div>
              <div className="rx-stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <StatTile label="Now serving" value={inChamber[0] ? `#${inChamber[0].token_number}` : '—'} />
                <StatTile label="Waiting" value={waiting.length} />
              </div>
              <p style={{ margin: 0, fontSize: 'var(--rx-fs-label)', lineHeight: 1.55, color: 'var(--rx-ink-2)' }}>
                The patient app shows this same list, so people know how many are ahead of them.
              </p>
            </div>
          </Card>
          <div style={{ padding: '18px 20px', borderRadius: 'var(--rx-r-lg)', background: 'var(--rx-surface-2)' }}>
            <strong>Strict queue isolation</strong>
            <div style={{ fontSize: 'var(--rx-fs-label)', lineHeight: 1.55, color: 'var(--rx-ink-2)', marginTop: 4 }}>
              This list shows only {doctor?.name ?? "this doctor's"} patients. Switching doctor changes the whole queue.
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

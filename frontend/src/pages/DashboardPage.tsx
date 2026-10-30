import React, { useEffect, useState } from 'react';
import { Callout, Card, EmptyState, StatTile } from '../design-system';
import { getJson } from '../api';
import type { Doctor } from '../types/index';

interface DashboardPageProps {
  doctors: Doctor[];
}

interface QueueRow {
  id: number;
  token_number: number;
  doctor_id: number;
  status: 'Waiting' | 'In Consultation' | 'Completed';
  created_at: string;
}

interface RxRow {
  id: number;
  is_signed: boolean;
  created_at: string;
}


const sameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString();

/** Manager overview. Every number here is counted from the real queue and prescriptions, nothing is estimated. */
export const DashboardPage: React.FC<DashboardPageProps> = ({ doctors }) => {
  const [queue, setQueue] = useState<QueueRow[] | null>(null);
  const [rx, setRx] = useState<RxRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([getJson<QueueRow[]>('/queue', ctl.signal), getJson<RxRow[]>('/prescriptions', ctl.signal)])
      .then(([q, p]) => {
        setQueue(q);
        setRx(p);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(true);
      });
    return () => ctl.abort();
  }, []);

  const now = new Date();
  const today = (queue ?? []).filter((q) => sameDay(q.created_at, now));
  const seen = today.filter((q) => q.status === 'Completed').length;
  const waiting = today.filter((q) => q.status === 'Waiting').length;
  const inChamber = today.filter((q) => q.status === 'In Consultation').length;
  const signed = (rx ?? []).filter((p) => p.is_signed && sameDay(p.created_at, now)).length;

  // arrivals by hour, only for the hours that have data (plus one hour of context on each side)
  const byHour = new Map<number, number>();
  today.forEach((q) => byHour.set(new Date(q.created_at).getHours(), (byHour.get(new Date(q.created_at).getHours()) ?? 0) + 1));
  const hours = [...byHour.keys()];
  const from = hours.length ? Math.max(0, Math.min(...hours) - 1) : 0;
  const to = hours.length ? Math.min(23, Math.max(...hours) + 1) : 0;
  const series = hours.length ? Array.from({ length: to - from + 1 }, (_, i) => ({ hour: from + i, n: byHour.get(from + i) ?? 0 })) : [];
  const peak = Math.max(0, ...series.map((s) => s.n));
  const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

  return (
    <div className="rx-page">
      <div className="rx-shell">
        <main className="rx-shell__main">
          <header className="rx-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.01em' }}>Today at the clinic</h1>
              <span style={{ fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)' }}>
                {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · counted from the live queue
              </span>
            </div>
          </header>

          {error && (
            <Callout tone="attention" title="Can't reach the server">
              The numbers below need the BanglaRx API. Start it, then reload this page.
            </Callout>
          )}

          <section className="rx-tiles" aria-label="Key numbers">
            <StatTile tone="primary" label="Patients seen" value={queue ? seen : '—'} hint={queue ? `of ${today.length} who arrived today` : undefined} />
            <StatTile tone="attention" label="Waiting now" value={queue ? waiting : '—'} />
            <StatTile label="In chamber now" value={queue ? inChamber : '—'} />
            <StatTile label="Prescriptions signed" value={rx ? signed : '—'} hint="today" />
          </section>

          <div className="rx-row2">
            <Card style={{ flex: '3 1 420px' }}>
              <div className="rx-stack" style={{ gap: 14 }}>
                <div className="rx-row" style={{ justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 17 }}>Arrivals by hour</h2>
                  {peak > 0 && <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Busiest: {hourLabel(series.find((s) => s.n === peak)!.hour)}</span>}
                </div>
                {series.length === 0 ? (
                  <EmptyState title="No arrivals recorded today">Patients appear here as they are registered at reception.</EmptyState>
                ) : (
                  <>
                    <div className="rx-bars" role="img" aria-label={`Arrivals by hour: ${series.map((s) => `${hourLabel(s.hour)} ${s.n}`).join(', ')}`}>
                      {series.map((s) => (
                        <div key={s.hour} className={'rx-bar' + (s.n === peak ? ' rx-bar--peak' : '')}>
                          <span>{s.n}</span>
                          <div className="rx-bar__fill" style={{ height: `${peak ? (s.n / peak) * 100 : 0}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="rx-bars__axis" aria-hidden="true">
                      {series.map((s) => (
                        <span key={s.hour}>{hourLabel(s.hour)}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card style={{ flex: '2 1 300px' }}>
              <div className="rx-stack" style={{ gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>Not tracked yet</h2>
                <p style={{ margin: 0, fontSize: 'var(--rx-fs-label)', lineHeight: 1.6, color: 'var(--rx-ink-2)' }}>
                  Where bookings came from, no-shows, hand-offs from Rubina to reception, waiting time, and AI spend appear here once the booking app and its tables exist. They are left out instead of estimated.
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <div className="rx-stack" style={{ gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Doctors right now</h2>
              {doctors.length === 0 ? (
                <EmptyState title="No doctors yet" />
              ) : (
                doctors.map((d) => {
                  const mine = today.filter((q) => q.doctor_id === d.id);
                  const current = mine.find((q) => q.status === 'In Consultation');
                  const waitingMine = mine.filter((q) => q.status === 'Waiting').length;
                  return (
                    <div key={d.id} className="rx-docrow">
                      <span className={'rx-docrow__dot' + (current ? '' : ' rx-docrow__dot--idle')} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                        <strong style={{ fontSize: 15 }}>{d.name}</strong>
                        <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
                          {d.specialization} · {d.room_no} · {current ? `token ${current.token_number} in chamber` : 'no one in chamber'}
                        </div>
                      </div>
                      <span className="rx-badge rx-badge--attention">{waitingMine} waiting</span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
};

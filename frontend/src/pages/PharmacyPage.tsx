import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge, Callout, Card, EmptyState, PageHeader, PatientBanner, TextField } from '../design-system';
import { getJson } from '../api';

interface RxListRow {
  id: number;
  rx_number: string;
  is_signed: boolean;
  version?: number;
  created_at: string;
  patient_name: string;
  doctor_name: string;
}

interface RxDetail {
  prescription: {
    id: number;
    rx_number: string;
    is_signed: boolean;
    version?: number;
    created_at: string;
    doctor_name: string;
    doctor_specialization: string;
    patient_name: string;
    patient_age: number;
    patient_gender: string;
    patient_blood_group?: string;
    patient_phone?: string;
    patient_allergies?: string;
  };
  items: Array<{
    brandName: string;
    genericName: string;
    form: string;
    strength: string;
    dosagePattern: string;
    duration: string;
    instructionsBangla: string;
  }>;
}

/** Find a prescription by its Rx number and check what to hand over. Shows only what a pharmacist needs: no diagnosis, no notes. */
export const PharmacyPage: React.FC = () => {
  const [list, setList] = useState<RxListRow[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<RxDetail | null>(null);
  const [given, setGiven] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const ctl = new AbortController();
    getJson<RxListRow[]>('/prescriptions', ctl.signal)
      .then(setList)
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(true);
      });
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    if (selected === null) return;
    const ctl = new AbortController();
    setDetail(null);
    setGiven({});
    getJson<RxDetail>(`/prescriptions/${selected}`, ctl.signal)
      .then(setDetail)
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(true);
      });
    return () => ctl.abort();
  }, [selected]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter((r) => !q || r.rx_number.toLowerCase().includes(q) || r.patient_name.toLowerCase().includes(q)).slice(0, 8);
  }, [list, query]);

  const rx = detail?.prescription;
  const markedCount = detail ? detail.items.filter((_, i) => given[i]).length : 0;

  return (
    <div className="rx-page">
      <PageHeader title="Pharmacy" subtitle="Find a prescription by its Rx number or the patient's name" backHref="#/dashboard" backLabel="Back to the overview" />

      <main className="rx-split">
        <aside className="rx-split__side" aria-label="Find a prescription">
          <Card>
            <div className="rx-stack" style={{ gap: 14 }}>
              <TextField
                label="Rx number or patient name"
                placeholder="e.g. RX-20261029-00002"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {error && <Callout tone="attention" title="Can't reach the server">Start the BanglaRx API, then try again.</Callout>}
              {!error && list === null && <span style={{ color: 'var(--rx-ink-2)' }}>Loading prescriptions…</span>}
              {list && matches.length === 0 && <EmptyState title="No prescription found">Check the number on the patient's printout.</EmptyState>}
              <ul className="rx-recent" aria-label="Matching prescriptions">
                {matches.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="rx-recent__btn" aria-current={selected === r.id} onClick={() => setSelected(r.id)}>
                      <strong style={{ fontFamily: 'var(--rx-font-mono)', fontSize: 14 }}>{r.rx_number}</strong>
                      <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
                        {r.patient_name} · {r.doctor_name} · {new Date(r.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <div style={{ padding: '14px 18px', borderRadius: 'var(--rx-r-md)', background: 'var(--rx-surface-2)', fontSize: 'var(--rx-fs-label)', lineHeight: 1.55, color: 'var(--rx-ink-2)' }}>
            You see only what is needed to hand over medicines. Diagnosis, notes and recordings are not shown.
          </div>
        </aside>

        <section className="rx-split__main" aria-label="Prescription to hand over">
          {!rx ? (
            <Card>
              <EmptyState title={selected === null ? 'Choose a prescription' : 'Loading…'}>
                {selected === null ? 'Search on the left, then tap the prescription to see its medicines.' : undefined}
              </EmptyState>
            </Card>
          ) : (
            <>
              {rx.is_signed ? (
                <Callout tone="success" icon={<ShieldCheck size={24} />} title="Signed by the doctor">
                  {rx.doctor_name} signed this prescription on {new Date(rx.created_at).toLocaleDateString('en-GB')}
                  {rx.version && rx.version > 1 ? ` · version ${rx.version}` : ''}.
                </Callout>
              ) : (
                <Callout tone="danger" icon={<ShieldAlert size={24} />} title="Not signed">
                  This prescription is still a draft. Do not hand over medicines until the doctor signs it.
                </Callout>
              )}

              <PatientBanner
                name={rx.patient_name}
                ageSex={`${rx.patient_age}Y / ${rx.patient_gender}`}
                allergies={rx.patient_allergies}
                bloodGroup={rx.patient_blood_group}
              />

              <ul className="rx-queuelist" aria-label="Medicines">
                {detail!.items.map((m, i) => (
                  <li key={i}>
                    <Card style={{ padding: '14px 18px' }}>
                      <label className="rx-checkrow">
                        <input type="checkbox" className="rx-check" checked={!!given[i]} onChange={(e) => setGiven({ ...given, [i]: e.target.checked })} />
                        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                          <strong style={{ fontSize: 18 }}>{m.brandName}</strong>
                          <span style={{ display: 'block', fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
                            {m.genericName} · {m.form} · {m.strength}
                          </span>
                        </span>
                        <span style={{ textAlign: 'right', lineHeight: 1.35 }}>
                          <strong style={{ fontFamily: 'var(--rx-font-mono)', fontSize: 17 }}>{m.dosagePattern || '—'}</strong>
                          <span style={{ display: 'block', fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{m.duration || '—'}</span>
                        </span>
                      </label>
                      {m.instructionsBangla && <div className="rx-bn" style={{ marginTop: 6, paddingLeft: 40, color: 'var(--rx-ink-2)' }}>{m.instructionsBangla}</div>}
                    </Card>
                  </li>
                ))}
              </ul>

              <div className="rx-row" style={{ justifyContent: 'space-between' }}>
                <Badge tone={markedCount === detail!.items.length ? 'success' : 'neutral'}>
                  {markedCount} of {detail!.items.length} ticked
                </Badge>
                <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Ticks help you check the bag. They are not saved yet.</span>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Headset, Send } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState, PageHeader, SegmentedControl, TextField } from '../design-system';
import { getJson, sendJson } from '../api';

interface Row {
  id: number;
  channel: string;
  status: 'rubina' | 'needs_human' | 'human' | 'booked';
  handledBy?: string;
  lastMessageAt: string;
  preview?: string;
  facts: Record<string, string>;
}
interface Msg {
  id: number;
  sender: 'patient' | 'rubina' | 'staff';
  body: string;
  createdAt: string;
}
interface Thread {
  id: number;
  status: Row['status'];
  handledBy?: string;
  facts: Record<string, string>;
  messages: Msg[];
}

const TAG: Record<Row['status'], { label: string; tone: 'attention' | 'success' | 'neutral' | 'primary' }> = {
  needs_human: { label: 'Needs you', tone: 'attention' },
  human: { label: 'A person is handling', tone: 'success' },
  rubina: { label: 'Rubina is handling', tone: 'neutral' },
  booked: { label: 'Booked by Rubina', tone: 'primary' },
};
const FACT_LABEL: Array<[string, string]> = [
  ['forWhom', 'Patient'],
  ['concern', 'Concern'],
  ['specialty', 'Suggested specialty'],
  ['suggestedDoctors', 'Suggested doctor'],
];
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};

/** Reception inbox: chats Rubina could not finish, plus every chat on "All". */
export const InboxPage: React.FC = () => {
  const [filter, setFilter] = useState<'needs' | 'all'>('needs');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      setRows(await getJson<Row[]>(`/inbox?filter=${filter}`));
    } catch {
      setError("Can't reach the server. Start the BanglaRx API (and sign in if it asks), then reload.");
    }
  }, [filter]);

  const loadThread = useCallback(async (id: number) => {
    try {
      setThread(await getJson<Thread>(`/inbox/${id}`));
    } catch {
      /* the next poll will try again */
    }
  }, []);

  useEffect(() => {
    loadList();
    const t = window.setInterval(loadList, 6000);
    return () => window.clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (selected === null) return;
    loadThread(selected);
    const t = window.setInterval(() => loadThread(selected), 4000);
    return () => window.clearInterval(t);
  }, [selected, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  const take = async () => {
    if (!thread) return;
    setBusy(true);
    setError('');
    const r = await sendJson<unknown>('POST', `/inbox/${thread.id}/take`, {});
    setBusy(false);
    if (!r.ok) setError(r.errors.join(' '));
    loadThread(thread.id);
    loadList();
  };

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !text.trim()) return;
    setBusy(true);
    setError('');
    const r = await sendJson<unknown>('POST', `/inbox/${thread.id}/reply`, { text });
    setBusy(false);
    if (!r.ok) setError(r.errors.join(' '));
    else setText('');
    loadThread(thread.id);
  };

  const waiting = rows?.filter((r) => r.status === 'needs_human').length ?? 0;

  return (
    <div className="rx-page">
      <PageHeader title="Rubina inbox" subtitle="Chats that need a person, and what Rubina understood" backHref="#/queue" backLabel="Back to the queue" live />
      <main style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '0 var(--rx-gutter, 16px) 24px', alignItems: 'flex-start' }}>
        <section aria-label="Chats" style={{ flex: '1 1 280px', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SegmentedControl
            label="Filter"
            value={filter}
            onChange={(v) => { setFilter(v as 'needs' | 'all'); setSelected(null); setThread(null); }}
            options={[{ value: 'needs', label: `Needs you${filter === 'needs' && rows ? ` · ${waiting}` : ''}` }, { value: 'all', label: 'All' }]}
          />
          {rows === null && !error && <span>Loading…</span>}
          {rows?.length === 0 && <EmptyState icon={<Headset size={32} />} title={filter === 'needs' ? 'Nobody is waiting for a person' : 'No chats yet'} />}
          {rows?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setSelected(r.id); setError(''); }}
              aria-current={selected === r.id}
              className="rx-card"
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: 14, borderRadius: 18, border: '1px solid var(--rx-outline)', background: selected === r.id ? 'var(--rx-primary-container)' : 'var(--rx-surface)', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <span className="rx-row" style={{ justifyContent: 'space-between' }}>
                <strong>Visitor {r.id} · {r.channel}</strong>
                <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{ago(r.lastMessageAt)}</span>
              </span>
              <span className="rx-bn" style={{ fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.preview}</span>
              <span><Badge tone={TAG[r.status].tone}>{TAG[r.status].label}</Badge></span>
            </button>
          ))}
        </section>

        <section aria-label="Conversation" style={{ flex: '2 1 360px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          {error && <Callout tone="danger">{error}</Callout>}
          {!thread ? (
            <EmptyState icon={<Headset size={32} />} title="Choose a chat" />
          ) : (
            <Card>
              <div className="rx-stack" style={{ gap: 12 }}>
                <div className="rx-row" style={{ justifyContent: 'space-between' }}>
                  <strong>Visitor {thread.id}</strong>
                  {thread.status === 'human' ? <Badge tone="success">{thread.handledBy ? `${thread.handledBy} is handling this chat` : 'A person is handling this chat'}</Badge> : thread.status === 'needs_human' || thread.status === 'rubina' ? <Button onClick={take} disabled={busy} icon={<Headset size={18} />}>Take over from Rubina</Button> : null}
                </div>
                <div className="rx-stack" style={{ gap: 8, maxHeight: 420, overflowY: 'auto' }} aria-live="polite">
                  {thread.messages.map((m) => (
                    <div key={m.id} style={{ alignSelf: m.sender === 'patient' ? 'flex-start' : 'flex-end', maxWidth: '86%' }}>
                      <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{m.sender === 'patient' ? 'Visitor' : m.sender === 'rubina' ? 'Rubina (AI)' : 'Reception'}</div>
                      <div className="rx-bn" style={{ padding: '8px 12px', borderRadius: 16, background: m.sender === 'patient' ? 'var(--rx-surface-2)' : m.sender === 'rubina' ? 'var(--rx-primary-container)' : 'var(--rx-surface-3)', color: 'var(--rx-ink)' }}>{m.body}</div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <form className="rx-row" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'nowrap' }} onSubmit={reply}>
                  <div style={{ flex: 1 }}>
                    <TextField label="Reply" placeholder={thread.status === 'human' ? 'Reply to the patient' : 'Take over to reply'} value={text} onChange={(e) => setText(e.target.value)} disabled={thread.status !== 'human'} maxLength={1000} />
                  </div>
                  <Button type="submit" icon={<Send size={18} />} disabled={busy || thread.status !== 'human' || !text.trim()}>Send</Button>
                </form>
              </div>
            </Card>
          )}
        </section>

        <aside aria-label="What Rubina understood" style={{ flex: '1 1 260px', maxWidth: 340 }}>
          {thread && (
            <Card>
              <div className="rx-stack" style={{ gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 'var(--rx-fs-h3, 18px)' }}>What Rubina understood</h2>
                {FACT_LABEL.map(([k, label]) => (
                  <div key={k}>
                    <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{label}</div>
                    <strong style={{ color: thread.facts[k] ? 'var(--rx-ink)' : 'var(--rx-ink-3)' }}>{thread.facts[k] || 'Not said yet'}</strong>
                  </div>
                ))}
                {thread.facts.redFlag && <Callout tone="danger">Red-flag words were used. Rubina told the visitor to go to an emergency department.</Callout>}
                <Callout tone="info">The specialty is only a suggestion. The patient or you can change it.</Callout>
                <Button variant="outlined" onClick={() => (window.location.hash = '#/bookings')}>Create booking from this</Button>
              </div>
            </Card>
          )}
        </aside>
      </main>
    </div>
  );
};

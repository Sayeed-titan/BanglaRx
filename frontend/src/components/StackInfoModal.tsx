import React from 'react';
import { Layers, ShieldCheck, Database, Cpu, Activity } from 'lucide-react';
import { Button, Modal } from '../design-system';

interface StackInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PILLARS = [
  {
    icon: <Cpu size={20} />,
    bg: 'var(--rx-primary-container)',
    ink: 'var(--rx-on-primary-container)',
    title: 'Ambient clinical intelligence layer',
    text: 'Proprietary multimodal neural orchestration pipeline with deterministic JSON schema enforcement. Processes unscripted bilingual speech (Bangla, English, Banglish) with sub-2s latency.',
  },
  {
    icon: <Database size={20} />,
    bg: 'var(--rx-info)',
    ink: 'var(--rx-on-info)',
    title: 'Enterprise clinical knowledge vault',
    text: 'High-performance relational persistence engine with trigram fuzzy similarity indexing. Grounds every entity against certified DGDA pharmaceutical brands and official generics.',
  },
  {
    icon: <ShieldCheck size={20} />,
    bg: 'var(--rx-danger)',
    ink: 'var(--rx-on-danger)',
    title: 'Drug-drug interaction (DDI) safety interceptor',
    text: 'Pre-emptive clinical rules evaluator executing pharmacokinetic and pharmacodynamic conflict checks prior to prescription signing.',
  },
  {
    icon: <Activity size={20} />,
    bg: 'var(--rx-success)',
    ink: 'var(--rx-on-success)',
    title: 'Accessibility and patient mobile gateway',
    text: 'Dynamic cryptographic QR code packaging paired with client-side Bengali acoustic synthesis (text-to-speech) for complete patient adherence.',
  },
];

const FACTS = [
  ['Runtime environment', 'Asynchronous minimal core API'],
  ['Client layer', 'React 19 + TypeScript + Vite'],
  ['Clinical compliance', 'BMDC prescribing guidelines'],
  ['Security architecture', 'Doctor-in-the-loop isolation'],
];

export const StackInfoModal: React.FC<StackInfoModalProps> = ({ isOpen, onClose }) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    size="md"
    icon={<Layers size={22} aria-hidden="true" />}
    title="System architecture and technical specifications"
    subtitle="BanglaRx AI ambient clinical infrastructure"
    footer={<Button onClick={onClose}>Close overview</Button>}
  >
    <div className="rx-stack" style={{ gap: 18 }}>
      {PILLARS.map((p) => (
        <div key={p.title} className="rx-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
          <span aria-hidden="true" style={{ display: 'flex', padding: 10, borderRadius: 'var(--rx-r-sm)', background: p.bg, color: p.ink, flex: 'none' }}>
            {p.icon}
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--rx-fs-body)' }}>{p.title}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)', lineHeight: 1.55 }}>{p.text}</p>
          </div>
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: 16, borderRadius: 'var(--rx-r-md)', background: 'var(--rx-bg)', border: '1px solid var(--rx-outline)' }}>
        {FACTS.map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{k}</div>
            <strong style={{ fontSize: 'var(--rx-fs-label)' }}>{v}</strong>
          </div>
        ))}
      </div>
    </div>
  </Modal>
);

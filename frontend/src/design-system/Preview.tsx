import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  AppBar, Avatar, Badge, Button, LinkButton, Callout, Card, Chip, Composer, EmptyState, IconButton, MedicineRow, MessageBubble, MicPod,
  Modal, NavRail, PageHeader, PatientBanner, QueueCard, Rx, SegmentedControl, Select, StatTile, Switch, TextField, Textarea, TokenBadge,
  TypingDots, VitalRow,
} from './index';

/** Open the app with ?ds to see every component. Not part of the product UI. */
export default function Preview() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [density, setDensity] = useState<'patient' | 'clinic' | 'compact'>('clinic');
  const [large, setLarge] = useState(false);
  const [sw, setSw] = useState(true);
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [chip, setChip] = useState(true);
  const [draft, setDraft] = useState('');
  const [mic, setMic] = useState(false);
  const [modal, setModal] = useState(false);
  const [meds, setMeds] = useState([
    { brand: 'Napa Extra', generic: 'Paracetamol 500 mg + Caffeine 65 mg', dosage: '1+0+1', duration: '৫ দিন', note: 'খাওয়ার পরে' },
    { brand: 'Seclo 20', generic: 'Omeprazole 20 mg', dosage: '1+0+1', duration: '১৪ দিন', note: 'খাওয়ার ২০ মিনিট আগে' },
  ]);

  return (
    <Rx theme={theme} density={density} text={large ? 'large' : 'normal'} style={{ minHeight: '100vh', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header className="rx-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--rx-fs-title)' }}>BanglaRx design system</h1>
            <span style={{ color: 'var(--rx-ink-2)', fontSize: 'var(--rx-fs-label)' }}>v0.1 · tokens and first components</span>
          </div>
          <div className="rx-row">
            <SegmentedControl label="Theme" value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
            <SegmentedControl label="Density" value={density} onChange={setDensity} options={[{ value: 'patient', label: 'Patient' }, { value: 'clinic', label: 'Clinic' }, { value: 'compact', label: 'Compact' }]} />
            <Chip selected={large} onClick={() => setLarge(!large)}>A+ text</Chip>
          </div>
        </header>

        <Card>
          <h2 style={{ marginTop: 0 }}>Actions</h2>
          <div className="rx-row">
            <Button>Filled</Button>
            <Button variant="tonal">Tonal</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="text">Text</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="attention">Attention</Button>
            <LinkButton href="#/queue" variant="tonal">Link button</LinkButton>
            <Button disabled>Disabled</Button>
            <Button size="lg" icon={<Plus size={20} />}>Large with icon</Button>
            <IconButton aria-label="Add" variant="filled"><Plus size={22} /></IconButton>
          </div>
          <div className="rx-row" style={{ marginTop: 16 }}>
            <Switch label="Notifications" checked={sw} onChange={setSw} />
            <span>{sw ? 'On' : 'Off'}</span>
            <SegmentedControl label="Language" value={lang} onChange={setLang} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} />
            <Chip selected={chip} onClick={() => setChip(!chip)}>Suggestion</Chip>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Badges, callouts, tiles</h2>
          <div className="rx-row">
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="success">Matched</Badge>
            <Badge tone="attention">Waiting</Badge>
            <Badge tone="danger">Penicillin allergy</Badge>
            <Badge tone="info">AI note</Badge>
            <Avatar initials="Dr" />
            <TokenBadge number={7} state="active" />
            <TokenBadge number={8} />
            <TokenBadge number={6} state="done" />
          </div>
          <div className="rx-stack" style={{ marginTop: 16 }}>
            <Callout tone="danger" title="Dangerous combination: Warfarin + Aspirin">Raises the risk of serious bleeding. Remove aspirin or monitor INR.</Callout>
            <Callout tone="info" title="Good to know">Sathi suggests. The prescribing decision is always yours.</Callout>
            <Callout tone="success" title="All clear">No conflicts with the chart.</Callout>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
            <StatTile tone="primary" label="Patients seen" value={42} hint="of 58" />
            <StatTile label="Average wait" value="28 min" hint="Target under 30" />
            <StatTile tone="attention" label="No-shows" value={5} />
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Fields and clinical</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <TextField label="Full name" required placeholder="e.g. Shahnaz Begum" />
            <TextField label="Temperature" suffix="°F" type="number" placeholder="98.6" helper="Leave blank if not measured" />
            <TextField label="Mobile number" defaultValue="+880 " error="Enter all 11 digits" />
          </div>
          <div className="rx-stack" style={{ marginTop: 16 }}>
            <PatientBanner name="Shahnaz Begum" ageSex="38Y / Female" bloodGroup="Unknown" allergies="" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
              <VitalRow label="Temp" value="102 °F" hot />
              <VitalRow label="Pulse" value="84 bpm" />
              <VitalRow label="Weight" />
            </div>
            {meds.map((m, i) => (
              <MedicineRow key={m.brand} index={i + 1} {...m} onRemove={() => setMeds(meds.filter((_, j) => j !== i))} />
            ))}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Voice, queue, layout</h2>
          <div className="rx-stack">
            <MicPod listening={mic} onToggle={() => setMic(!mic)} text={mic ? 'Listening…' : 'Tap the mic and talk to the patient'} />
            <QueueCard
              token={7}
              name="Shahnaz Begum"
              meta="38Y, Female"
              status="Waiting"
              complaint="Fever and body ache"
              vitals={[{ label: 'Temp', value: '102 °F', hot: true }, { label: 'Pulse', value: '84 bpm' }]}
              uid="P-0007"
              action={<Button variant="outlined">Call into chamber</Button>}
            />
            <QueueCard token={8} name="Sufia Begum" meta="7Y, Female" status="In Consultation" active />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Select label="Doctor and chamber"><option>Dr. A. Rahman, Medicine</option><option>Dr. [Name], Paediatrics</option></Select>
              <Textarea label="Notes" placeholder="Type or speak" rows={3} />
            </div>
            <EmptyState title="No patients in today's queue">Choose New patient to register one.</EmptyState>
            <Button onClick={() => setModal(true)}>Open a dialog</Button>
            <div style={{ border: '1px solid var(--rx-outline)', borderRadius: 'var(--rx-r-md)', overflow: 'hidden' }}>
              <AppBar brand={<strong>BanglaRx AI</strong>} actions={<Button variant="tonal">Action</Button>} sub={<span>Second row</span>} />
            </div>
            <div style={{ border: '1px solid var(--rx-outline)', borderRadius: 'var(--rx-r-md)', overflow: 'hidden' }}>
              <PageHeader title="Today's chamber queue" subtitle="Dr. A. Rahman · Room 302" backHref="#/" backLabel="Back to workbench" live actions={<Button variant="tonal">New patient</Button>} />
            </div>
            <div style={{ border: '1px solid var(--rx-outline)', borderRadius: 'var(--rx-r-md)', overflow: 'hidden' }}>
              <NavRail label="Example menu" items={[{ href: '#/dashboard', label: 'Overview', current: true }, { href: '#/pharmacy', label: 'Pharmacy' }]} />
            </div>
            <Modal open={modal} onClose={() => setModal(false)} title="Example dialog" subtitle="Esc closes it, Tab stays inside" size="sm" footer={<Button onClick={() => setModal(false)}>Done</Button>}>
              Dialogs return focus to the button that opened them.
            </Modal>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Chat</h2>
          <div className="rx-stack">
            <MessageBubble from="user" meta="10:43">Fever for 3 days with a dry cough. What can I give at 52 kg?</MessageBubble>
            <MessageBubble from="assistant" meta="Rx সাথী · 10:43">Here are options that fit the chart. Amoxicillin is left out because of the penicillin allergy.</MessageBubble>
            <MessageBubble from="assistant" streaming>আগে বলুন, শ্বাসকষ্ট আছে কি</MessageBubble>
            <TypingDots />
            <Composer value={draft} onChange={setDraft} onSend={() => setDraft('')} onMic={() => {}} />
          </div>
        </Card>
      </div>
    </Rx>
  );
}

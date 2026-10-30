import React, { useState } from 'react';
import { BadgeCheck, CalendarCheck, CheckCircle2, ClipboardList, FileText, Headset, ListOrdered, LockKeyhole, Mic, Pill, ShieldCheck, Sparkles, Stethoscope, TriangleAlert, UserRound, Users } from 'lucide-react';
import { Button, Card, LinkButton, Rx, SegmentedControl, TextField } from '../design-system';
import { num, setLang, useLang } from '../patient/i18n';
import type { Lang } from '../patient/i18n';
import { COPY } from './content';
import type { Point } from './content';
import { useInstall } from '../pwa/useInstall';

const ICONS = {
  patients: [Headset, CalendarCheck, ListOrdered, Pill, FileText, LockKeyhole],
  doctors: [Mic, ShieldCheck, ClipboardList, Sparkles, Stethoscope, BadgeCheck],
  clinics: [CalendarCheck, ListOrdered, Headset, Users, Pill, UserRound],
};

const Points: React.FC<{ points: Point[]; icons: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>[] }> = ({ points, icons }) => (
  <div className="rx-land__grid">
    {points.map((p, i) => {
      const Icon = icons[i % icons.length];
      return (
        <Card key={p.title}>
          <div className="rx-stack" style={{ gap: 8 }}>
            <span className="rx-land__icon"><Icon size={22} aria-hidden /></span>
            <h3 className="rx-land__h3">{p.title}</h3>
            <p className="rx-land__p">{p.text}</p>
          </div>
        </Card>
      );
    })}
  </div>
);

const Section: React.FC<{ id: string; kicker?: string; title: string; lead?: string; tint?: boolean; children: React.ReactNode }> = ({ id, kicker, title, lead, tint, children }) => (
  <section id={id} className={'rx-land__section' + (tint ? ' rx-land__section--tint' : '')} aria-labelledby={`${id}-h`}>
    <div className="rx-land__wrap rx-stack" style={{ gap: 24 }}>
      <header className="rx-stack" style={{ gap: 8, maxWidth: 760 }}>
        {kicker && <span className="rx-land__kicker">{kicker}</span>}
        <h2 id={`${id}-h`} className="rx-land__h2 rx-bn">{title}</h2>
        {lead && <p className="rx-land__lead">{lead}</p>}
      </header>
      {children}
    </div>
  </section>
);

/** Plain arithmetic on the clinic's own numbers. Nothing here is a promise: the saving per patient is the clinic's own estimate. */
const Estimator: React.FC<{ lang: Lang }> = ({ lang }) => {
  const c = COPY[lang].calc;
  const [v, setV] = useState({ doctors: '2', patients: '30', minutes: '10', saved: '2', fee: '500', days: '26' });
  const n = (k: keyof typeof v) => Math.max(0, parseFloat(v[k]) || 0);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value.replace(/[^\d.]/g, '') });

  const freedMin = n('patients') * n('saved'); // per doctor, per day
  const newLength = n('minutes') - n('saved');
  const extraPerDay = newLength > 0 && n('minutes') > 0 ? Math.floor(freedMin / newLength) : 0;
  const extraMonth = extraPerDay * n('days') * n('doctors');
  const income = extraMonth * n('fee');
  const ready = n('patients') > 0 && n('minutes') > 0 && n('saved') > 0 && n('saved') < n('minutes');
  const fmt = (x: number) => num(lang, Math.round(x).toLocaleString('en-IN'));

  return (
    <Card>
      <div className="rx-stack" style={{ gap: 16 }}>
        <div className="rx-stack" style={{ gap: 4 }}>
          <h3 className="rx-land__h3">{c.title}</h3>
          <p className="rx-land__p">{c.lead}</p>
        </div>
        <div className="rx-land__calc">
          <TextField label={c.doctors} inputMode="numeric" value={v.doctors} onChange={set('doctors')} />
          <TextField label={c.patients} inputMode="numeric" value={v.patients} onChange={set('patients')} />
          <TextField label={c.minutes} inputMode="numeric" value={v.minutes} onChange={set('minutes')} />
          <TextField label={c.saved} inputMode="decimal" value={v.saved} onChange={set('saved')} />
          <TextField label={c.fee} inputMode="numeric" value={v.fee} onChange={set('fee')} />
          <TextField label={c.days} inputMode="numeric" value={v.days} onChange={set('days')} />
        </div>
        <div className="rx-land__result" aria-live="polite">
          <strong>{c.resultTitle}</strong>
          {ready ? (
            <div className="rx-land__stats">
              <div><span>{c.freed}</span><strong>{num(lang, (freedMin / 60).toFixed(1))} {c.hours}</strong></div>
              <div><span>{c.extra}</span><strong>{fmt(extraMonth)}</strong></div>
              <div><span>{c.income}</span><strong>৳{fmt(income)} <small>{c.perMonth}</small></strong></div>
            </div>
          ) : (
            <span className="rx-land__p">{c.needMore}</span>
          )}
          <span className="rx-land__fine">{c.note}</span>
        </div>
      </div>
    </Card>
  );
};

/** The public home page. Nobody needs to sign in to read it; every internal screen sits behind the staff sign-in. */
export const Landing: React.FC = () => {
  const lang = useLang();
  const t = COPY[lang];
  const pwa = useInstall();

  return (
    <Rx density="patient" className="rx-land">
      <header className="rx-land__bar">
        <div className="rx-land__wrap rx-land__barin">
          <a href="#/" className="rx-brand" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="BanglaRx home">
            <div className="rx-brand__mark" aria-hidden="true"><Stethoscope size={22} /></div>
            <div className="rx-brand__name">BanglaRx</div>
          </a>
          <nav className="rx-land__links" aria-label="Sections">
            <a href="#patients-sec" onClick={(e) => jump(e, 'patients')}>{t.nav.patients}</a>
            <a href="#doctors-sec" onClick={(e) => jump(e, 'doctors')}>{t.nav.doctors}</a>
            <a href="#clinics-sec" onClick={(e) => jump(e, 'clinics')}>{t.nav.clinics}</a>
            <a href="#how-sec" onClick={(e) => jump(e, 'how')}>{t.nav.how}</a>
          </nav>
          <div className="rx-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <SegmentedControl label="Language" value={lang} onChange={setLang} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} />
            <LinkButton href="#/login" variant="outlined" className="rx-land__signin">{t.nav.staffSignIn}</LinkButton>
          </div>
        </div>
      </header>

      <main>
        <section className="rx-land__hero" aria-labelledby="hero-h">
          <div className="rx-land__wrap rx-stack" style={{ gap: 20 }}>
            <span className="rx-land__kicker">{t.hero.kicker}</span>
            <h1 id="hero-h" className="rx-land__h1 rx-bn">{t.hero.title}</h1>
            <p className="rx-land__lead" style={{ maxWidth: 680 }}>{t.hero.lead}</p>
            <div className="rx-row" style={{ gap: 12 }}>
              <LinkButton href="#/rubina" size="lg" icon={<Headset size={20} />}>{t.hero.find}</LinkButton>
              <LinkButton href="#/patient" size="lg" variant="outlined" icon={<UserRound size={20} />}>{t.nav.patientSignIn}</LinkButton>
              <LinkButton href="#clinics-sec" size="lg" variant="text" onClick={(e) => jump(e, 'clinics')}>{t.hero.clinicsCta}</LinkButton>
            </div>
            <div className="rx-row" style={{ gap: 12 }}>
              <span className="rx-land__fine">{t.hero.note}</span>
              {pwa.canInstall && <Button variant="tonal" onClick={pwa.install}>{lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install the app'}</Button>}
            </div>
          </div>
        </section>

        <Section id="patients-sec" kicker={t.patients.kicker} title={t.patients.title} lead={t.patients.lead}>
          <Points points={t.patients.points} icons={ICONS.patients} />
        </Section>

        <Section id="doctors-sec" kicker={t.doctors.kicker} title={t.doctors.title} lead={t.doctors.lead} tint>
          <Points points={t.doctors.points} icons={ICONS.doctors} />
          <Card active>
            <div className="rx-stack" style={{ gap: 10 }}>
              <strong className="rx-row" style={{ gap: 8 }}><CheckCircle2 size={20} aria-hidden="true" /> {t.doctors.proofTitle}</strong>
              <ul className="rx-land__proof">{t.doctors.proof.map((p) => <li key={p}>{p}</li>)}</ul>
              <span className="rx-land__fine">{t.doctors.proofNote}</span>
            </div>
          </Card>
        </Section>

        <Section id="clinics-sec" kicker={t.clinics.kicker} title={t.clinics.title} lead={t.clinics.lead}>
          <Points points={t.clinics.points} icons={ICONS.clinics} />
          <h3 className="rx-land__h2 rx-bn" style={{ fontSize: 'var(--rx-fs-title)' }}>{t.clinics.impactTitle}</h3>
          <div className="rx-land__grid">
            {t.clinics.impact.map((p) => (
              <div key={p.title} className="rx-land__impact">
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </div>
            ))}
          </div>
          <Estimator lang={lang} />
        </Section>

        <Section id="how-sec" title={t.how.title} tint>
          <div className="rx-land__grid rx-land__grid--two">
            {[{ title: t.how.patientTitle, steps: t.how.patientSteps }, { title: t.how.clinicTitle, steps: t.how.clinicSteps }].map((g) => (
              <Card key={g.title}>
                <div className="rx-stack" style={{ gap: 12 }}>
                  <h3 className="rx-land__h3">{g.title}</h3>
                  <ol className="rx-land__steps">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="trust-sec" title={t.trust.title}>
          <div className="rx-land__grid">
            {t.trust.points.map((p, i) => {
              const Icon = [ShieldCheck, FileText, LockKeyhole, TriangleAlert][i % 4];
              return (
                <Card key={p.title}>
                  <div className="rx-stack" style={{ gap: 8 }}>
                    <span className="rx-land__icon"><Icon size={22} aria-hidden /></span>
                    <h3 className="rx-land__h3">{p.title}</h3>
                    <p className="rx-land__p">{p.text}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>

        <section className="rx-land__cta" aria-labelledby="cta-h">
          <div className="rx-land__wrap rx-stack" style={{ gap: 16, alignItems: 'flex-start' }}>
            <h2 id="cta-h" className="rx-land__h2 rx-bn">{t.cta.title}</h2>
            <p className="rx-land__lead">{t.cta.lead}</p>
            <div className="rx-row" style={{ gap: 12 }}>
              <LinkButton href="#/rubina" size="lg" icon={<Headset size={20} />}>{t.cta.find}</LinkButton>
              <LinkButton href="#/patient" size="lg" variant="outlined">{t.cta.patient}</LinkButton>
              <LinkButton href="#/login" size="lg" variant="outlined">{t.cta.staff}</LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="rx-land__foot">
        <div className="rx-land__wrap rx-row" style={{ justifyContent: 'space-between' }}>
          <span>{t.footer}</span>
          <span className="rx-land__fine">© {new Date().getFullYear()} BanglaRx</span>
        </div>
      </footer>
    </Rx>
  );
};

/** Scrolls to a section without changing the address (the address is the router). */
function jump(e: React.MouseEvent, key: string) {
  e.preventDefault();
  document.getElementById(`${key}-sec`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

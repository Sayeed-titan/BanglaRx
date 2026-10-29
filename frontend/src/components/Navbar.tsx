import React from 'react';
import { Stethoscope, Users, UserPlus, Settings, Moon, Sun } from 'lucide-react';
import type { Doctor } from '../types/index';
import { AppBar, Chip, IconButton, LinkButton, Select, usePrefs } from '../design-system';

interface NavbarProps {
  doctors: Doctor[];
  selectedDoctor: Doctor | null;
  setSelectedDoctor: (doc: Doctor) => void;
  queueCount: number;
  waitingCount: number;
  onOpenDoctorProfile: () => void;
}

/** Workbench app bar, as designed: brand, doctor, queue, new patient. */
export const Navbar: React.FC<NavbarProps> = ({
  doctors,
  selectedDoctor,
  setSelectedDoctor,
  queueCount,
  waitingCount,
  onOpenDoctorProfile,
}) => {
  const { prefs, setTheme, setText } = usePrefs();

  return (
    <AppBar
      brand={
        <div className="rx-brand">
          <div className="rx-brand__mark" aria-hidden="true">
            <Stethoscope size={24} />
          </div>
          <div>
            <div className="rx-brand__name">BanglaRx AI</div>
            <div className="rx-brand__sub">Consultation workbench</div>
          </div>
        </div>
      }
      actions={
        <>
          <Select
            label="Doctor and chamber"
            hideLabel
            className="rx-select--wide"
            value={selectedDoctor?.id || ''}
            onChange={(e) => {
              const doc = doctors.find((d) => d.id === Number(e.target.value));
              if (doc) setSelectedDoctor(doc);
            }}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.specialization} · {d.room_no}
              </option>
            ))}
          </Select>
          <IconButton aria-label="Chamber and doctor setup" onClick={onOpenDoctorProfile}>
            <Settings size={20} />
          </IconButton>
          <LinkButton href="#/queue" variant={waitingCount > 0 ? 'attention' : 'outlined'} icon={<Users size={18} />}>
            Queue · {waitingCount} waiting{queueCount > waitingCount ? ` of ${queueCount}` : ''}
          </LinkButton>
          <LinkButton href="#/register" variant="tonal" icon={<UserPlus size={18} />}>
            New patient
          </LinkButton>
          <Chip selected={prefs.text === 'large'} onClick={() => setText(prefs.text === 'large' ? 'normal' : 'large')}>
            A+
          </Chip>
          <IconButton
            aria-label={prefs.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(prefs.theme === 'dark' ? 'light' : 'dark')}
          >
            {prefs.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
        </>
      }
    />
  );
};

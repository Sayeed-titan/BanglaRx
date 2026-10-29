import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './actions';
import { cx, NOT_RECORDED } from './utils';

/* ---- VitalRow: an empty value reads "Not recorded", never zero or a guess ---- */
export interface VitalRowProps {
  label: string;
  value?: string | null;
  /** highlights an abnormal reading */
  hot?: boolean;
}

export function VitalRow({ label, value, hot }: VitalRowProps) {
  const has = Boolean(value && value.trim());
  return (
    <div className="rx-vital">
      <span className="rx-vital__k">{label}</span>
      <strong className={cx('rx-vital__v', hot && has && 'rx-vital__v--hot', !has && 'rx-vital__v--missing')}>{has ? value : NOT_RECORDED}</strong>
    </div>
  );
}

/* ---- PatientBanner ----------------------------------------------------------- */
export interface PatientBannerProps {
  name?: string;
  /** for example "38Y / Female" */
  ageSex?: string;
  bloodGroup?: string;
  allergies?: string;
  phone?: string;
}

function BannerItem({ k, v }: { k: string; v?: string }) {
  const has = Boolean(v && v.trim() && v !== 'Unknown');
  return (
    <span>
      <span className="rx-banner__k">{k} </span>
      <strong className={cx('rx-banner__v', !has && 'rx-banner__v--missing')}>{has ? v : NOT_RECORDED}</strong>
    </span>
  );
}

export function PatientBanner({ name, ageSex, bloodGroup, allergies, phone }: PatientBannerProps) {
  return (
    <div className="rx-banner">
      <BannerItem k="Patient" v={name} />
      <BannerItem k="Age / sex" v={ageSex} />
      <BannerItem k="Blood group" v={bloodGroup} />
      <BannerItem k="Allergies" v={allergies} />
      {phone !== undefined && <BannerItem k="Phone" v={phone} />}
    </div>
  );
}

/* ---- MedicineRow: every line can be changed or removed ------------------------ */
export interface MedicineRowProps {
  index: number;
  brand: string;
  generic?: string;
  /** for example 1+0+1 */
  dosage: string;
  duration: string;
  /** instruction in Bangla, such as "খাওয়ার পরে" */
  note?: string;
  onRemove?: () => void;
  /** shown above the controls, for example a formulary match question */
  notice?: ReactNode;
  /** on-screen editing controls (hidden when printing) */
  controls?: ReactNode;
  /** plain text shown only when printing, in place of the controls */
  printText?: ReactNode;
}

export function MedicineRow({ index, brand, generic, dosage, duration, note, onRemove, notice, controls, printText }: MedicineRowProps) {
  return (
    <div className={cx('rx-med', controls ? 'rx-med--edit' : false)}>
      <span className="rx-med__n">{index}</span>
      <div className="rx-med__body">
        <div className="rx-med__head">
          <strong className="rx-med__brand">{brand}</strong>
          {generic && <span className="rx-med__generic">{generic}</span>}
        </div>
        <div className="rx-med__chips">
          <span className="rx-med__dose">{dosage}</span>
          <span className="rx-med__dur">{duration}</span>
        </div>
        {note && <span className="rx-med__note rx-bn">{note}</span>}
        {notice && <div className="rx-med__notice no-print">{notice}</div>}
        {controls && <div className="no-print">{controls}</div>}
        {printText && <div className="rx-pad__print">{printText}</div>}
      </div>
      {onRemove && (
        <IconButton aria-label={`Remove ${brand}`} onClick={onRemove} className="no-print">
          <Trash2 size={20} />
        </IconButton>
      )}
    </div>
  );
}

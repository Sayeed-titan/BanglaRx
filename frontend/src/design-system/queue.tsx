import type { ReactNode } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from './display';
import { TokenBadge } from './display';
import { cx } from './utils';

export interface QueueCardProps {
  token: number | string;
  name: string;
  /** for example "38Y, Female" */
  meta: string;
  status: 'Waiting' | 'In Consultation' | 'Completed';
  complaint?: string;
  /** only the readings that were actually recorded */
  vitals?: Array<{ label: string; value: string; hot?: boolean }>;
  /** patient id shown small at the bottom */
  uid?: string;
  active?: boolean;
  /** the primary action for a waiting patient */
  action?: ReactNode;
}

export function QueueCard({ token, name, meta, status, complaint, vitals = [], uid, active, action }: QueueCardProps) {
  return (
    <article className={cx('rx-qcard', active && 'rx-qcard--active')}>
      <div className="rx-qcard__top">
        <div className="rx-qcard__who">
          <TokenBadge number={`#${token}`} state={status === 'In Consultation' ? 'active' : status === 'Completed' ? 'done' : 'waiting'} />
          <div>
            <div className="rx-qcard__name">{name}</div>
            <div className="rx-qcard__meta">{meta}</div>
          </div>
        </div>
        {status === 'In Consultation' ? (
          <Badge tone="primary">In chamber</Badge>
        ) : status === 'Completed' ? (
          <Badge tone="success" icon={<CheckCircle2 size={14} />}>
            Completed
          </Badge>
        ) : (
          <Badge tone="attention" icon={<Clock size={14} />}>
            Waiting
          </Badge>
        )}
      </div>
      <div className="rx-qcard__line">
        <strong>Complaint:</strong> {complaint || 'General checkup'}
      </div>
      <div className="rx-qcard__vitals">
        {vitals.length === 0 ? (
          <Badge tone="outline">Vitals not recorded</Badge>
        ) : (
          vitals.map((v) => (
            <Badge key={v.label} tone={v.hot ? 'danger' : 'outline'}>
              {v.label} {v.value}
            </Badge>
          ))
        )}
      </div>
      <div className="rx-qcard__foot">
        <span className="rx-qcard__meta">{uid ? `ID: ${uid}` : ''}</span>
        {active ? <Badge tone="primary" icon={<CheckCircle2 size={14} />}>Open in the pad</Badge> : action}
      </div>
    </article>
  );
}

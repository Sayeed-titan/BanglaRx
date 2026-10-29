import React from 'react';
import { Volume2, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Badge, Button, Modal } from '../design-system';

interface PatientQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRxNumber: string;
  medicinesCount: number;
  onSpeakBangla: (text: string) => void;
}

export const PatientQrModal: React.FC<PatientQrModalProps> = ({
  isOpen,
  onClose,
  savedRxNumber,
  medicinesCount,
  onSpeakBangla,
}) => {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      icon={<Smartphone size={22} aria-hidden="true" />}
      title="Patient mobile passport"
      subtitle="Digital copy and Bangla audio guidance"
      footer={
        <>
          <Button variant="tonal" onClick={onClose}>
            Close
          </Button>
          <Button
            icon={<Volume2 size={18} />}
            onClick={() => onSpeakBangla('আপনার প্রেসক্রিপশন তৈরি হয়েছে। ডাক্তারের পরামর্শ অনুযায়ী সময়মতো নিয়মিত ওষুধ গ্রহণ করুন।')}
          >
            <span className="rx-bn">টেস্ট অডিও · Play voice</span>
          </Button>
        </>
      }
    >
      <div className="rx-stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p style={{ margin: 0, color: 'var(--rx-ink-2)', lineHeight: 1.55 }}>
          Scan with any phone camera to open the digital prescription and hear the directions in Bangla.
        </p>
        <div className="rx-qr">
          <QRCodeSVG value={`https://banglarx.local/patient/${savedRxNumber}`} size={170} level="M" />
        </div>
        <div className="rx-row" style={{ justifyContent: 'center', gap: 8 }}>
          <Badge tone="primary">
            Rx ID <strong style={{ fontFamily: 'var(--rx-font-mono)' }}>{savedRxNumber || 'not saved yet'}</strong>
          </Badge>
          <Badge>{medicinesCount} items prescribed</Badge>
        </div>
      </div>
    </Modal>
  );
};

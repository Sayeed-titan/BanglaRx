import React from 'react';
import { Volume2, X, Smartphone, QrCode, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="anim-scale-in"
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--slate-200)',
          overflow: 'hidden',
          textAlign: 'center'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--slate-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--slate-50)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: 'var(--teal-50)',
              color: 'var(--teal-700)',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex'
            }}>
              <Smartphone size={18} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '0.94rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                Patient Mobile Passport
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                Digital access & Bengali audio guidance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-clinical btn-outline"
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '24px 24px 18px 24px' }}>
          
          <p style={{ fontSize: '0.82rem', color: 'var(--slate-600)', marginBottom: '18px', lineHeight: 1.5 }}>
            Scan with any smartphone camera to open the digital prescription and listen to voice directions in Bengali.
          </p>

          {/* QR Code Container */}
          <div style={{
            display: 'inline-block',
            padding: '16px',
            background: 'var(--slate-50)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--slate-200)',
            marginBottom: '16px'
          }}>
            <QRCodeSVG
              value={`https://banglarx.local/patient/${savedRxNumber}`}
              size={170}
              level="M"
            />
          </div>

          {/* Rx Meta Badge */}
          <div style={{
            background: 'var(--teal-50)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem',
            color: 'var(--teal-800)',
            fontWeight: '600',
            border: '1px solid var(--teal-100)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>Rx ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{savedRxNumber}</strong></span>
            <span>•</span>
            <span>{medicinesCount} Items Prescribed</span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                onSpeakBangla("আপনার প্রেসক্রিপশন তৈরি হয়েছে। ডাক্তারের পরামর্শ অনুযায়ী সময়মতো নিয়মিত ওষুধ গ্রহণ করুন।");
              }}
              className="btn-clinical btn-primary-teal"
              style={{ flex: 1, padding: '10px', fontSize: '0.82rem' }}
            >
              <Volume2 size={16} />
              <span className="font-bangla">টেস্ট অডিও (Play Voice)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-clinical btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.82rem' }}
            >
              Close
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

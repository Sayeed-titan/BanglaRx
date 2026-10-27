import React from 'react';
import { Volume2 } from 'lucide-react';
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
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.5)', 
      backdropFilter: 'blur(4px)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{ 
        background: '#FFFFFF', 
        borderRadius: '16px', 
        width: '90%', 
        maxWidth: '460px', 
        padding: '28px',
        boxShadow: 'var(--shadow-xl)',
        textAlign: 'center'
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B' }}>
          Patient Mobile Passport
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '4px', marginBottom: '20px' }}>
          Scan this QR code with any smartphone to open the patient's prescription with Bengali audio readout.
        </p>

        <div style={{ 
          display: 'inline-block', 
          padding: '16px', 
          background: '#F8FAFC', 
          borderRadius: '12px',
          border: '2px solid #E2E8F0',
          marginBottom: '16px'
        }}>
          <QRCodeSVG 
            value={`https://banglarx.local/patient/${savedRxNumber}`} 
            size={180} 
            level="M"
          />
        </div>

        <div style={{ 
          background: '#EBF3FF', 
          padding: '12px', 
          borderRadius: '8px', 
          fontSize: '0.8rem', 
          color: '#0F52BA',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          Rx Number: {savedRxNumber} • {medicinesCount} Medicines Prescribed
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
              onSpeakBangla("আপনার প্রেসক্রিপশন তৈরি হয়েছে। ডাক্তারের পরামর্শ অনুযায়ী সময়মতো ওষুধ গ্রহণ করুন।");
            }}
            style={{ 
              flex: 1, 
              padding: '10px', 
              borderRadius: '8px', 
              border: 'none', 
              background: '#00A86B', 
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Volume2 size={16} /> টেস্ট অডিও (Play Voice)
          </button>

          <button 
            onClick={onClose}
            style={{ 
              flex: 1, 
              padding: '10px', 
              borderRadius: '8px', 
              border: '1px solid #CBD5E1', 
              background: '#FFFFFF', 
              color: '#475569',
              fontWeight: '700',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

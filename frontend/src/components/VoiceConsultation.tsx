import React from 'react';
import { Mic, MicOff, Sparkles, CheckCircle2, Square, Loader2, RotateCcw, Volume2 } from 'lucide-react';

export interface VoiceConsultationProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  speechLanguage?: 'bn-BD' | 'en-US';
  setSpeechLanguage?: (lang: 'bn-BD' | 'en-US') => void;
  transcript: string;
  setTranscript: (text: string) => void;
  onLoadScenario: (type: string) => void;
  onAnalyzeConsultation: () => void;
  onCancelGeneration?: () => void;
  isProcessing: boolean;
  executionTime?: number | null;
  aiMeta?: string;
  isAmendmentMode?: boolean;
  setIsAmendmentMode?: (val: boolean) => void;
  hasExistingPrescription?: boolean;
}

export const VoiceConsultation: React.FC<VoiceConsultationProps> = ({
  isRecording,
  onToggleRecording,
  speechLanguage = 'bn-BD',
  setSpeechLanguage,
  transcript,
  setTranscript,
  onLoadScenario,
  onAnalyzeConsultation,
  onCancelGeneration,
  isProcessing,
  hasExistingPrescription = false,
}) => {
  return (
    <div className="clinical-card" style={{ padding: '20px' }}>
      
      {/* Header: Unified Omnibox Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: hasExistingPrescription ? 'var(--amber-50)' : 'var(--teal-50)',
            color: hasExistingPrescription ? 'var(--amber-700)' : 'var(--teal-700)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex'
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--slate-900)' }}>
              Unified Voice Omnibox (ভয়েস ও টেক্সট কনসাল্টেশন)
            </h2>
            <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
              Auto-detects Bangla, English & Banglish • Voice scribing, edits & amendments
            </p>
          </div>
        </div>

        {/* Ambient Engine Micro-Pill */}
        {setSpeechLanguage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--slate-100)',
            padding: '2px 4px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--slate-200)',
            fontSize: '0.7rem'
          }}>
            <button
              type="button"
              onClick={() => setSpeechLanguage('bn-BD')}
              style={{
                border: 'none',
                background: speechLanguage === 'bn-BD' ? '#FFFFFF' : 'transparent',
                color: speechLanguage === 'bn-BD' ? 'var(--teal-700)' : 'var(--slate-500)',
                fontWeight: speechLanguage === 'bn-BD' ? '700' : '500',
                borderRadius: 'var(--radius-full)',
                padding: '3px 8px',
                cursor: 'pointer',
                boxShadow: speechLanguage === 'bn-BD' ? 'var(--shadow-subtle)' : 'none',
                transition: 'all 0.15s'
              }}
              title="Speech Engine: Bengali (বাংলাদেশ)"
            >
              🇧🇩 বাংলা
            </button>
            <button
              type="button"
              onClick={() => setSpeechLanguage('en-US')}
              style={{
                border: 'none',
                background: speechLanguage === 'en-US' ? '#FFFFFF' : 'transparent',
                color: speechLanguage === 'en-US' ? 'var(--teal-700)' : 'var(--slate-500)',
                fontWeight: speechLanguage === 'en-US' ? '700' : '500',
                borderRadius: 'var(--radius-full)',
                padding: '3px 8px',
                cursor: 'pointer',
                boxShadow: speechLanguage === 'en-US' ? 'var(--shadow-subtle)' : 'none',
                transition: 'all 0.15s'
              }}
              title="Speech Engine: English / Banglish"
            >
              🇬🇧 English / Banglish
            </button>
          </div>
        )}
      </div>

      {/* Hero Ambient Microphone Pod */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px',
        background: isRecording 
          ? 'var(--crimson-50)' 
          : hasExistingPrescription ? 'var(--amber-50)' : 'var(--slate-50)',
        borderRadius: 'var(--radius-lg)',
        border: isRecording 
          ? '1px solid var(--crimson-200)' 
          : hasExistingPrescription ? '1px dashed var(--amber-300)' : '1px dashed var(--slate-300)',
        marginBottom: '14px',
        transition: 'all var(--duration-normal) ease'
      }}>
        {/* Pulsing Mic Button */}
        <button
          type="button"
          onClick={onToggleRecording}
          className={isRecording ? 'anim-pulse-glow' : ''}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: 'none',
            background: isRecording 
              ? 'linear-gradient(135deg, var(--crimson-600) 0%, var(--crimson-700) 100%)' 
              : hasExistingPrescription 
                ? 'linear-gradient(135deg, var(--amber-600) 0%, var(--amber-700) 100%)' 
                : 'linear-gradient(135deg, var(--teal-600) 0%, var(--teal-700) 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isRecording ? '0 4px 14px rgba(225, 29, 72, 0.4)' : 'var(--shadow-elevated)',
            transition: 'all var(--duration-fast) var(--ease-spring)'
          }}
          title={isRecording ? 'Click to stop listening' : 'Click to start ambient voice capture'}
        >
          {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <p style={{
          marginTop: '10px',
          fontSize: '0.78rem',
          fontWeight: '600',
          color: isRecording 
            ? 'var(--crimson-700)' 
            : hasExistingPrescription ? 'var(--amber-800)' : 'var(--slate-700)',
          textAlign: 'center'
        }}>
          {isRecording 
            ? `Ambient listening active (${speechLanguage === 'bn-BD' ? 'বাংলা লিসেনিং' : 'English / Banglish'})...` 
            : hasExistingPrescription
              ? 'Click to speak changes or dictate new prescription'
              : 'Click mic to speak consultation or type freely below'}
        </p>

        {/* Dynamic Voice Waveform Equalizer */}
        {isRecording && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '8px',
            height: '22px'
          }}>
            <span className="equalizer-bar" style={{ animationDelay: '0.05s', background: 'var(--crimson-600)' }} />
            <span className="equalizer-bar" style={{ animationDelay: '0.25s', background: 'var(--crimson-600)' }} />
            <span className="equalizer-bar" style={{ animationDelay: '0.45s', background: 'var(--crimson-600)' }} />
            <span className="equalizer-bar" style={{ animationDelay: '0.15s', background: 'var(--crimson-600)' }} />
            <span className="equalizer-bar" style={{ animationDelay: '0.35s', background: 'var(--crimson-600)' }} />
            <span className="equalizer-bar" style={{ animationDelay: '0.55s', background: 'var(--crimson-600)' }} />
          </div>
        )}
      </div>

      {/* Preset Clinical Cases & Amendment Chips */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px'
        }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quick Clinical Cases & Voice Amendment:
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--slate-400)' }}>
            One-click clinical preview
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <button
            type="button"
            onClick={() => onLoadScenario('bangla_pure')}
            className="btn-clinical"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--emerald-100)',
              background: 'var(--emerald-50)',
              fontSize: '0.72rem',
              color: 'var(--emerald-700)',
              textAlign: 'left',
              justifyContent: 'flex-start'
            }}
          >
            🇧🇩 ১. বিশুদ্ধ বাংলা
          </button>

          <button
            type="button"
            onClick={() => onLoadScenario('fever')}
            className="btn-clinical btn-secondary"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.72rem',
              textAlign: 'left',
              justifyContent: 'flex-start'
            }}
          >
            🌡️ ২. Fever & Acidity
          </button>

          <button
            type="button"
            onClick={() => onLoadScenario('diabetes')}
            className="btn-clinical btn-secondary"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.72rem',
              textAlign: 'left',
              justifyContent: 'flex-start'
            }}
          >
            🩺 ৩. Diabetes & BP
          </button>

          <button
            type="button"
            onClick={() => onLoadScenario('edit_interval')}
            className="btn-clinical"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--amber-200)',
              background: 'var(--amber-50)',
              fontSize: '0.72rem',
              color: 'var(--amber-800)',
              textAlign: 'left',
              justifyContent: 'flex-start'
            }}
          >
            ⚡ ৪. Voice Edit Rx
          </button>
        </div>
      </div>

      {/* Omnibox Dialogue Area with Clear Action */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <label style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--slate-700)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={13} color="var(--teal-600)" />
            <span>Consultation Dialogue / Voice Amendment Input:</span>
          </label>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {transcript && (
              <button
                type="button"
                onClick={() => setTranscript('')}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '0.7rem',
                  color: 'var(--slate-400)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 4px'
                }}
                title="Clear transcript"
              >
                <RotateCcw size={11} /> Clear
              </button>
            )}
            <span className="badge-clinical badge-teal" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
              <CheckCircle2 size={10} /> Auto-detect Intent
            </span>
          </div>
        </div>

        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="Consultation dialogue appears here in real-time. Speak or type freely in বাংলা, English, or Banglish (e.g. describe patient symptoms, or dictate amendments like 'নাপা এক্সট্রা এর ডোজ দিনে ৪ বার করুন', 'Add Monas 10mg at night')..."
          rows={4}
          className={`textarea-clinical ${speechLanguage === 'bn-BD' ? 'font-bangla' : ''}`}
          style={{
            lineHeight: 1.6,
            fontSize: '0.86rem',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Clinical Synthesis / Amendment Action Button with Cancel Control */}
      {isProcessing ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
          <button
            type="button"
            disabled
            className="btn-clinical btn-primary-teal"
            style={{
              padding: '11px 16px',
              fontSize: '0.86rem',
              borderRadius: 'var(--radius-md)',
              opacity: 0.9,
              cursor: 'wait',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Loader2 size={17} className="anim-spin" />
            <span>Processing Consultation & Grounding Rx...</span>
          </button>

          {onCancelGeneration && (
            <button
              type="button"
              onClick={onCancelGeneration}
              className="btn-clinical"
              style={{
                background: 'var(--crimson-50)',
                color: 'var(--crimson-700)',
                border: '1px solid var(--crimson-300)',
                padding: '11px 16px',
                fontSize: '0.82rem',
                fontWeight: '700',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              title="Stop and abort AI generation immediately"
            >
              <Square size={13} fill="var(--crimson-600)" />
              <span>Stop (বন্ধ করুন)</span>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onAnalyzeConsultation}
          disabled={!transcript.trim()}
          className="btn-clinical btn-primary-teal"
          style={{
            width: '100%',
            padding: '11px 16px',
            fontSize: '0.88rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-elevated)'
          }}
        >
          <Sparkles size={17} />
          {hasExistingPrescription 
            ? 'Process Consultation / Apply Changes (প্রেসক্রিপশন তৈরি বা সংশোধন করুন)' 
            : 'Generate Prescription (প্রেসক্রিপশন তৈরি করুন)'}
        </button>
      )}

      {/* Compliance Note */}
      <div style={{
        fontSize: '0.7rem',
        color: 'var(--slate-400)',
        textAlign: 'center',
        marginTop: '8px'
      }}>
        BanglaRx AI™ Omnibox • Grounded against DGDA National Formulary • 100% Doctor Override
      </div>

    </div>
  );
};

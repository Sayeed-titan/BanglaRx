import React from 'react';
import { Mic, MicOff, Sparkles, CheckCircle2, Edit3, MessageSquarePlus, Square, Loader2 } from 'lucide-react';

interface VoiceConsultationProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  speechLanguage: 'bn-BD' | 'en-US';
  setSpeechLanguage: (lang: 'bn-BD' | 'en-US') => void;
  transcript: string;
  setTranscript: (text: string) => void;
  onLoadScenario: (type: string) => void;
  onAnalyzeConsultation: () => void;
  onCancelGeneration?: () => void;
  isProcessing: boolean;
  executionTime: number | null;
  aiMeta: string;
  isAmendmentMode?: boolean;
  setIsAmendmentMode?: (val: boolean) => void;
  hasExistingPrescription?: boolean;
}

export const VoiceConsultation: React.FC<VoiceConsultationProps> = ({
  isRecording,
  onToggleRecording,
  speechLanguage,
  setSpeechLanguage,
  transcript,
  setTranscript,
  onLoadScenario,
  onAnalyzeConsultation,
  onCancelGeneration,
  isProcessing,
  isAmendmentMode = false,
  setIsAmendmentMode,
  hasExistingPrescription = false,
}) => {
  return (
    <div className="clinical-card" style={{ padding: '22px' }}>
      
      {/* Header & Language Mode Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: isAmendmentMode ? 'var(--amber-50)' : 'var(--teal-50)',
            color: isAmendmentMode ? 'var(--amber-700)' : 'var(--teal-700)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex'
          }}>
            {isAmendmentMode ? <Edit3 size={16} /> : <Sparkles size={16} />}
          </div>
          <div>
            <h2 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--slate-900)' }}>
              {isAmendmentMode ? 'Prescription Voice Amendment' : 'Ambient Consultation & Voice Capture'}
            </h2>
            <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
              {isAmendmentMode ? 'Speak modifications to alter active prescription' : 'Hands-free clinical conversation scribing'}
            </p>
          </div>
        </div>

        {/* Dynamic Language Mode Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          background: 'var(--slate-100)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--slate-200)'
        }}>
          <button
            type="button"
            onClick={() => setSpeechLanguage('bn-BD')}
            style={{
              border: 'none',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.74rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: speechLanguage === 'bn-BD' ? '#FFFFFF' : 'transparent',
              color: speechLanguage === 'bn-BD' ? 'var(--teal-700)' : 'var(--slate-600)',
              boxShadow: speechLanguage === 'bn-BD' ? 'var(--shadow-subtle)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🇧🇩 বাংলা (bn-BD)
          </button>

          <button
            type="button"
            onClick={() => setSpeechLanguage('en-US')}
            style={{
              border: 'none',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.74rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: speechLanguage === 'en-US' ? '#FFFFFF' : 'transparent',
              color: speechLanguage === 'en-US' ? 'var(--teal-700)' : 'var(--slate-600)',
              boxShadow: speechLanguage === 'en-US' ? 'var(--shadow-subtle)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🇬🇧 English / Banglish
          </button>
        </div>
      </div>

      {/* Mode Switcher: Initial Consultation vs Voice Amendment */}
      {setIsAmendmentMode && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
          padding: '4px',
          background: 'var(--slate-100)',
          borderRadius: 'var(--radius-md)'
        }}>
          <button
            type="button"
            onClick={() => setIsAmendmentMode(false)}
            style={{
              border: 'none',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: !isAmendmentMode ? '#FFFFFF' : 'transparent',
              color: !isAmendmentMode ? 'var(--slate-900)' : 'var(--slate-600)',
              boxShadow: !isAmendmentMode ? 'var(--shadow-subtle)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Mic size={14} color={!isAmendmentMode ? 'var(--teal-600)' : 'var(--slate-400)'} />
            <span>Full Consultation Scribe</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAmendmentMode(true)}
            style={{
              border: 'none',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: isAmendmentMode ? '#FFFFFF' : 'transparent',
              color: isAmendmentMode ? 'var(--amber-800)' : 'var(--slate-600)',
              boxShadow: isAmendmentMode ? 'var(--shadow-subtle)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Edit3 size={14} color={isAmendmentMode ? 'var(--amber-600)' : 'var(--slate-400)'} />
            <span>Voice Edit / Modify Rx</span>
          </button>
        </div>
      )}

      {/* Hero Ambient Microphone Pod */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        background: isRecording 
          ? 'var(--crimson-50)' 
          : isAmendmentMode ? 'var(--amber-50)' : 'var(--slate-50)',
        borderRadius: 'var(--radius-lg)',
        border: isRecording 
          ? '1px solid var(--crimson-100)' 
          : isAmendmentMode ? '1px dashed var(--amber-300)' : '1px dashed var(--slate-300)',
        marginBottom: '18px',
        transition: 'all var(--duration-normal) ease'
      }}>
        {/* Pulsing Mic Button */}
        <button
          type="button"
          onClick={onToggleRecording}
          className={isRecording ? 'anim-pulse-glow' : ''}
          style={{
            width: '62px',
            height: '62px',
            borderRadius: '50%',
            border: 'none',
            background: isRecording 
              ? 'linear-gradient(135deg, var(--crimson-600) 0%, var(--crimson-700) 100%)' 
              : isAmendmentMode 
                ? 'linear-gradient(135deg, var(--amber-600) 0%, var(--amber-700) 100%)' 
                : 'linear-gradient(135deg, var(--slate-900) 0%, var(--slate-800) 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isRecording ? '0 4px 14px rgba(225, 29, 72, 0.4)' : 'var(--shadow-elevated)',
            transition: 'all var(--duration-fast) var(--ease-spring)'
          }}
          title={isRecording ? 'Click to stop listening' : 'Click to start voice capture'}
        >
          {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
        </button>

        <p style={{
          marginTop: '12px',
          fontSize: '0.8rem',
          fontWeight: '600',
          color: isRecording 
            ? 'var(--crimson-700)' 
            : isAmendmentMode ? 'var(--amber-800)' : 'var(--slate-700)'
        }}>
          {isRecording 
            ? `Microphone listening (${speechLanguage === 'bn-BD' ? 'বাংলা লিসেনিং' : 'English / Banglish'})...`
            : isAmendmentMode 
              ? 'Speak prescription changes (e.g. "Change Napa to every 4 hours, add Monas 10")'
              : 'Click microphone to start consultation scribing'}
        </p>

        {/* Dynamic Voice Waveform Equalizer */}
        {isRecording && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '10px',
            height: '28px'
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

      {/* Preset Consultation & Voice Edit Scenarios */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isAmendmentMode ? 'Voice Amendment Test Prompts:' : 'Sample Clinical Cases:'}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
            One-click clinical preview
          </span>
        </div>

        {isAmendmentMode ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onLoadScenario('edit_interval')}
              className="btn-clinical"
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--amber-200)',
                background: 'var(--amber-50)',
                fontSize: '0.74rem',
                color: 'var(--amber-800)',
                textAlign: 'left',
                justifyContent: 'flex-start'
              }}
            >
              ⏱️ "Change Napa dosage to every 4 hours"
            </button>

            <button
              type="button"
              onClick={() => onLoadScenario('edit_add_med')}
              className="btn-clinical"
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--teal-200)',
                background: 'var(--teal-50)',
                fontSize: '0.74rem',
                color: 'var(--teal-800)',
                textAlign: 'left',
                justifyContent: 'flex-start'
              }}
            >
              💊 "Add Tab. Monas 10 at night for 14 days"
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onLoadScenario('bangla_pure')}
              className="btn-clinical"
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--emerald-100)',
                background: 'var(--emerald-50)',
                fontSize: '0.74rem',
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
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.74rem',
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
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.74rem',
                textAlign: 'left',
                justifyContent: 'flex-start'
              }}
            >
              🩺 ৩. Diabetes & BP
            </button>

            <button
              type="button"
              onClick={() => onLoadScenario('interaction')}
              className="btn-clinical"
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--crimson-100)',
                background: 'var(--crimson-50)',
                fontSize: '0.74rem',
                color: 'var(--crimson-700)',
                textAlign: 'left',
                justifyContent: 'flex-start'
              }}
            >
              ⚠️ ৪. Warfarin Alert
            </button>
          </div>
        )}
      </div>

      {/* Consultation Transcript Area */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--slate-700)' }}>
            {isAmendmentMode ? 'Prescription Change Command:' : `Consultation Dialogue (${speechLanguage === 'bn-BD' ? 'বাংলা' : 'English / Banglish'}):`}
          </label>
          <span className="badge-clinical badge-teal" style={{ fontSize: '0.7rem' }}>
            <CheckCircle2 size={11} /> Voice Scribe Ready
          </span>
        </div>

        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={isAmendmentMode 
            ? "e.g. Doctor dictates: 'Change Napa Extra dosage to every 4 hours instead of 3 times, and add Monas 10mg one tablet at bedtime for 14 days'..."
            : "Consultation speech appears here in real-time, or you can type doctor notes manually..."}
          rows={isAmendmentMode ? 3 : 4}
          className={`textarea-clinical ${speechLanguage === 'bn-BD' ? 'font-bangla' : ''}`}
          style={{
            lineHeight: 1.6,
            fontSize: '0.86rem',
            resize: 'vertical',
            borderColor: isAmendmentMode ? 'var(--amber-300)' : undefined
          }}
        />
      </div>

      {/* Clinical Synthesis / Amendment Action Button */}
      {isProcessing ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
          <button
            type="button"
            disabled
            className="btn-clinical btn-primary-teal"
            style={{
              padding: '12px 18px',
              fontSize: '0.88rem',
              borderRadius: 'var(--radius-md)',
              opacity: 0.9,
              cursor: 'wait',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Loader2 size={18} className="anim-spin" />
            <span>{isAmendmentMode ? 'Applying Amendments...' : 'Generating Prescription...'}</span>
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
                padding: '12px 16px',
                fontSize: '0.84rem',
                fontWeight: '700',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              title="Stop and abort AI generation immediately"
            >
              <Square size={14} fill="var(--crimson-600)" />
              <span>Stop (বন্ধ করুন)</span>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onAnalyzeConsultation}
          disabled={!transcript.trim()}
          className={`btn-clinical ${isAmendmentMode ? 'btn-primary-slate' : 'btn-primary-teal'}`}
          style={{
            width: '100%',
            padding: '12px 18px',
            fontSize: '0.9rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-elevated)'
          }}
        >
          <Sparkles size={18} />
          {isAmendmentMode ? 'Apply Voice Amendment to Prescription' : 'Generate Prescription'}
        </button>
      )}

      {/* Subtitle & Compliance Note */}
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--slate-400)',
        textAlign: 'center',
        marginTop: '10px'
      }}>
        BanglaRx AI™ Clinical Assistant • Grounded against DGDA National Formulary
      </div>

    </div>
  );
};

import React from 'react';
import { Mic, MicOff, Sparkles, Volume2, Clock, Globe2 } from 'lucide-react';

interface VoiceConsultationProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  speechLanguage: 'bn-BD' | 'en-US';
  setSpeechLanguage: (lang: 'bn-BD' | 'en-US') => void;
  transcript: string;
  setTranscript: (text: string) => void;
  onLoadScenario: (type: string) => void;
  onAnalyzeConsultation: () => void;
  isProcessing: boolean;
  executionTime: number | null;
  aiMeta: string;
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
  isProcessing,
  executionTime,
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
            background: 'var(--teal-50)',
            color: 'var(--teal-700)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex'
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--slate-900)' }}>
              Ambient Consultation & Speech Scribe
            </h2>
            <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
              Continuous acoustic dialogue capture
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

      {/* Hero Ambient Microphone Pod */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        background: isRecording ? 'var(--crimson-50)' : 'var(--slate-50)',
        borderRadius: 'var(--radius-lg)',
        border: isRecording ? '1px solid var(--crimson-100)' : '1px dashed var(--slate-300)',
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
              : 'linear-gradient(135deg, var(--slate-900) 0%, var(--slate-800) 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isRecording ? '0 4px 14px rgba(225, 29, 72, 0.4)' : 'var(--shadow-elevated)',
            transition: 'all var(--duration-fast) var(--ease-spring)'
          }}
          title={isRecording ? 'Click to stop listening' : 'Click to start ambient listening'}
        >
          {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
        </button>

        <p style={{
          marginTop: '12px',
          fontSize: '0.8rem',
          fontWeight: '600',
          color: isRecording ? 'var(--crimson-700)' : 'var(--slate-700)'
        }}>
          {isRecording 
            ? `Ambient microphone active (${speechLanguage === 'bn-BD' ? 'বাংলা লিসেনিং' : 'English / Banglish'})...`
            : `Click microphone to start ambient scribing`}
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

      {/* Preset Rehearsal Scenarios */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quick Clinical Presets:
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
            One-click demonstration
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px'
        }}>
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
            🌡️ ২. Fever & Gastric
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
            Consultation Speech Narrative ({speechLanguage === 'bn-BD' ? 'বাংলা' : 'English / Banglish'}):
          </label>
          {executionTime && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: 'var(--emerald-700)',
              fontWeight: '700'
            }}>
              <Clock size={12} />
              Latency: {executionTime}ms
            </span>
          )}
        </div>

        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="Acoustic consultation speech appears here in real-time or type manually..."
          rows={4}
          className={`textarea-clinical ${speechLanguage === 'bn-BD' ? 'font-bangla' : ''}`}
          style={{
            lineHeight: 1.6,
            fontSize: '0.86rem',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Neural Synthesis Action Button */}
      <button
        type="button"
        onClick={onAnalyzeConsultation}
        disabled={isProcessing || !transcript.trim()}
        className="btn-clinical btn-primary-teal"
        style={{
          width: '100%',
          padding: '12px 18px',
          fontSize: '0.9rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-elevated)'
        }}
      >
        <Sparkles size={18} />
        {isProcessing ? 'Synthesizing Clinical Entities & Safety Intercept...' : 'Synthesize Prescription (BanglaRx AI)'}
      </button>

      {/* Subtitle & Compliance Note */}
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--slate-400)',
        textAlign: 'center',
        marginTop: '10px'
      }}>
        Ambient Neural Intelligence • Grounded against DGDA National Formulary
      </div>

    </div>
  );
};

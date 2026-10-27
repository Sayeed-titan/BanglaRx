import React from 'react';
import { Sparkles, Mic, MicOff } from 'lucide-react';

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
  aiMeta,
}) => {
  return (
    <div style={{ 
      background: '#FFFFFF', 
      borderRadius: '12px', 
      padding: '20px', 
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#0F52BA" />
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>
            Ambient Voice Consultation & Neural Parser
          </h2>
        </div>

        {/* Dynamic Language Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          <button 
            onClick={() => setSpeechLanguage('bn-BD')}
            style={{ 
              border: 'none', 
              padding: '4px 10px', 
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: speechLanguage === 'bn-BD' ? '#0F52BA' : 'transparent',
              color: speechLanguage === 'bn-BD' ? '#FFFFFF' : '#475569'
            }}
          >
            🇧🇩 বাংলা (bn-BD)
          </button>

          <button 
            onClick={() => setSpeechLanguage('en-US')}
            style={{ 
              border: 'none', 
              padding: '4px 10px', 
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: speechLanguage === 'en-US' ? '#0F52BA' : 'transparent',
              color: speechLanguage === 'en-US' ? '#FFFFFF' : '#475569'
            }}
          >
            🇬🇧 English / Banglish
          </button>
        </div>
      </div>

      {/* Mic Button & Waveform */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '16px',
        background: '#F8FAFC',
        borderRadius: '10px',
        border: '1px dashed #CBD5E1',
        marginBottom: '16px'
      }}>
        <button 
          onClick={onToggleRecording}
          style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            border: 'none',
            background: isRecording ? '#DC2626' : '#0F52BA',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isRecording ? '0 0 0 10px rgba(220,38,38,0.2)' : '0 4px 12px rgba(15,82,186,0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        
        <p style={{ marginTop: '12px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
          {isRecording 
            ? `Listening in ${speechLanguage === 'bn-BD' ? 'Bangla (বাংলা)' : 'English/Banglish'}...` 
            : `Click mic to speak in ${speechLanguage === 'bn-BD' ? 'Bangla (বাংলা)' : 'English/Banglish'}`}
        </p>

        {isRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', height: '30px' }}>
            <span className="wave-bar" style={{ animationDelay: '0.1s' }} />
            <span className="wave-bar" style={{ animationDelay: '0.3s' }} />
            <span className="wave-bar" style={{ animationDelay: '0.5s' }} />
            <span className="wave-bar" style={{ animationDelay: '0.2s' }} />
            <span className="wave-bar" style={{ animationDelay: '0.4s' }} />
            <span className="wave-bar" style={{ animationDelay: '0.6s' }} />
          </div>
        )}
      </div>

      {/* Stall Showcase Presets */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
          ⚡ Stall Showcase Presets (One-Click Rehearsal):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
          <button 
            onClick={() => onLoadScenario('bangla_pure')}
            style={{ 
              padding: '8px 8px', 
              borderRadius: '8px', 
              border: '1px solid #A7F3D0',
              background: '#ECFDF5',
              fontSize: '0.73rem',
              fontWeight: '700',
              color: '#065F46',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🇧🇩 1. বিশুদ্ধ বাংলা
          </button>

          <button 
            onClick={() => onLoadScenario('fever')}
            style={{ 
              padding: '8px 8px', 
              borderRadius: '8px', 
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.73rem',
              fontWeight: '600',
              color: '#0F52BA',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🌡️ 2. Banglish Fever
          </button>

          <button 
            onClick={() => onLoadScenario('diabetes')}
            style={{ 
              padding: '8px 8px', 
              borderRadius: '8px', 
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.73rem',
              fontWeight: '600',
              color: '#00A86B',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🩺 3. Diabetes & BP
          </button>

          <button 
            onClick={() => onLoadScenario('interaction')}
            style={{ 
              padding: '8px 8px', 
              borderRadius: '8px', 
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              fontSize: '0.73rem',
              fontWeight: '600',
              color: '#DC2626',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            ⚠️ 4. Warfarin DDI
          </button>
        </div>
      </div>

      {/* Transcript Textarea */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#475569' }}>
            Doctor-Patient Speech Narrative ({speechLanguage === 'bn-BD' ? 'বাংলা' : 'English / Banglish'}):
          </label>
          {executionTime && (
            <span style={{ fontSize: '0.72rem', color: '#00A86B', fontWeight: '700' }}>
              ⚡ Neural Latency: {executionTime}ms
            </span>
          )}
        </div>
        <textarea 
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="Doctor voice conversation in Bangla or English appears here..."
          rows={4}
          style={{ 
            width: '100%', 
            padding: '10px', 
            borderRadius: '8px', 
            border: '1px solid #CBD5E1',
            fontSize: '0.84rem',
            fontFamily: speechLanguage === 'bn-BD' ? 'var(--font-bangla)' : 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Process Button */}
      <button 
        onClick={onAnalyzeConsultation}
        disabled={isProcessing || !transcript.trim()}
        style={{ 
          width: '100%', 
          padding: '12px', 
          borderRadius: '8px', 
          border: 'none',
          background: isProcessing ? '#94A3B8' : '#0F52BA',
          color: '#FFFFFF',
          fontWeight: '700',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: isProcessing ? 'not-allowed' : 'pointer'
        }}
      >
        <Sparkles size={18} />
        {isProcessing ? 'Gemini Neural Network Reasoning...' : 'Process with Gemini Neural Engine (AI)'}
      </button>

      {/* Model Subtitle */}
      <div style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center', marginTop: '8px' }}>
        Engine: <strong>{aiMeta}</strong>
      </div>
    </div>
  );
};

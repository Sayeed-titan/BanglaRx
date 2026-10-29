import React from 'react';
import { Sparkles, Square, Loader2, RotateCcw } from 'lucide-react';
import { Button, Card, Chip, MicPod, SegmentedControl, Textarea } from '../design-system';

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

const SCENARIOS: Array<{ key: string; label: string }> = [
  { key: 'bangla_pure', label: '১. বিশুদ্ধ বাংলা' },
  { key: 'fever', label: '২. Fever and acidity' },
  { key: 'diabetes', label: '৩. Diabetes and BP' },
  { key: 'edit_interval', label: '৪. Voice edit Rx' },
];

/** The voice card, in the designed order: mic, what was said, try a case, draft. */
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
  const micText = isRecording
    ? `Listening (${speechLanguage === 'bn-BD' ? 'বাংলা' : 'English / Banglish'})…`
    : hasExistingPrescription
      ? 'Tap the mic to speak a change, or to dictate a new prescription'
      : 'Press the mic and speak';

  return (
    <Card aria-label="Voice consultation">
      <div className="rx-stack">
        <div className="rx-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Talk to the patient normally</h2>
            <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Bangla, English and Banglish all work</span>
          </div>
          {setSpeechLanguage && (
            <SegmentedControl
              label="Speech language"
              value={speechLanguage}
              onChange={setSpeechLanguage}
              options={[
                { value: 'bn-BD', label: 'বাংলা' },
                { value: 'en-US', label: 'English' },
              ]}
            />
          )}
        </div>

        <MicPod listening={isRecording} onToggle={onToggleRecording} mode={hasExistingPrescription ? 'amend' : 'new'} text={micText} />

        <div className="rx-stack" style={{ gap: 6 }}>
          <div className="rx-row" style={{ justifyContent: 'space-between' }}>
            <span className="rx-field__label">What was said</span>
            {transcript && (
              <Button variant="text" icon={<RotateCcw size={14} />} onClick={() => setTranscript('')}>
                Clear
              </Button>
            )}
          </div>
          <Textarea
            label="What was said"
            hideLabel
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            className={speechLanguage === 'bn-BD' ? 'rx-bn' : undefined}
            placeholder="The words appear here as you speak. You can also type or fix them, or dictate a change like 'Add Monas 10mg at night'."
          />
        </div>

        <div className="rx-row" style={{ gap: 8 }}>
          <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Try a case</span>
          {SCENARIOS.map((s) => (
            <Chip key={s.key} onClick={() => onLoadScenario(s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>

        {isProcessing ? (
          <div className="rx-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <Button size="lg" fullWidth disabled icon={<Loader2 size={18} className="anim-spin" />}>
              Reading the conversation…
            </Button>
            {onCancelGeneration && (
              <Button variant="danger" size="lg" icon={<Square size={14} fill="currentColor" />} onClick={onCancelGeneration} title="Stop the AI immediately">
                Stop
              </Button>
            )}
          </div>
        ) : (
          <Button size="lg" fullWidth icon={<Sparkles size={20} />} onClick={onAnalyzeConsultation} disabled={!transcript.trim()}>
            {hasExistingPrescription ? 'Apply the changes' : 'Draft the prescription'}
          </Button>
        )}
      </div>
    </Card>
  );
};

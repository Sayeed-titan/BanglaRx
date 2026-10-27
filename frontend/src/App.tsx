import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Stethoscope, AlertTriangle, CheckCircle2, 
  Printer, QrCode, Sparkles, Plus, Trash2, Volume2, 
  RotateCcw, Activity, ShieldAlert, HeartPulse, User, Clock,
  ChevronRight, Building2, Search, Cpu, FileText, Upload, Image as ImageIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// API Configuration
const API_BASE = 'http://localhost:5000/api';

interface Doctor {
  id: number;
  name: string;
  degrees: string;
  specialization: string;
  bmdc_reg_no: string;
  hospital_name: string;
  room_no: string;
}

interface Patient {
  id: number;
  patient_uid: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  blood_group: string;
  allergies: string;
  chronic_conditions: string;
}

interface PrescriptionItem {
  medicineId?: number;
  brandName: string;
  genericName: string;
  form: string;
  strength: string;
  dosagePattern: string;
  duration: string;
  instructionsBangla: string;
}

interface DrugWarning {
  drugA: string;
  drugB: string;
  severity: string;
  description: string;
  clinicalAdvice: string;
}

export default function App() {
  // State
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Mode Selection: Voice Consultation vs Paper Prescription OCR
  const [activeTab, setActiveTab] = useState<'voice' | 'ocr'>('voice');

  // Audio & Input State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMeta, setAiMeta] = useState<string>('Google Gemini 3.5 Flash (Neural Network) + PostgreSQL 18 RAG');
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Prescription Form State
  const [vitals, setVitals] = useState({ bp: '120/80 mmHg', temp: '98.6 F', pulse: '76 bpm' });
  const [complaints, setComplaints] = useState<string[]>(['Fever for 3 days', 'Severe headache', 'Heartburn']);
  const [diagnosis, setDiagnosis] = useState('Viral Fever with Acid Peptic Disease');
  const [medicines, setMedicines] = useState<PrescriptionItem[]>([
    {
      brandName: 'Napa Extra',
      genericName: 'Paracetamol + Caffeine',
      form: 'Tablet',
      strength: '500mg+65mg',
      dosagePattern: '1+0+1',
      duration: '5 days',
      instructionsBangla: 'ভরা পেটে খাবেন'
    },
    {
      brandName: 'Seclo 20',
      genericName: 'Omeprazole',
      form: 'Capsule',
      strength: '20mg',
      dosagePattern: '1+0+1',
      duration: '14 days',
      instructionsBangla: 'খাওয়ার ২০ মিনিট আগে'
    }
  ]);
  const [investigations, setInvestigations] = useState<string[]>(['CBC with ESR', 'Serum Creatinine', 'SGPT']);
  const [advice, setAdvice] = useState<string[]>([
    'পর্যাপ্ত পরিমাণে তরল খাবার, ডাবের পানি ও ওআরএস স্যালাইন পান করুন।',
    'কোনো ধরনের ব্যথানাশক ওষুধ (আইবুপ্রোফেন, ডাইক্লোফেনাক) গ্রহণ করবেন না।',
    'জ্বর ১০১ ডিগ্রির বেশি হলে কপালে জলপট্টি দিন।'
  ]);
  const [warnings, setWarnings] = useState<DrugWarning[]>([]);

  // Modals & UI Controls
  const [showQrModal, setShowQrModal] = useState(false);
  const [savedRxNumber, setSavedRxNumber] = useState('RX-2026-LIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Recognition ref
  const recognitionRef = useRef<any>(null);

  // Load initial data
  useEffect(() => {
    fetchStatus();
    fetchDoctors();
    fetchPatients();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setSystemStatus(data);
    } catch (err) {
      console.warn('Backend connection pending...');
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors`);
      const data = await res.json();
      setDoctors(data);
      if (data.length > 0) setSelectedDoctor(data[0]);
    } catch (err) {}
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE}/patients`);
      const data = await res.json();
      setPatients(data);
      if (data.length > 0) setSelectedPatient(data[0]);
    } catch (err) {}
  };

  // Medicine search
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      fetch(`${API_BASE}/medicines?q=${encodeURIComponent(searchQuery)}&limit=5`)
        .then(res => res.json())
        .then(data => setSearchResults(data))
        .catch(() => {});
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Speech Recognition
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } else {
        alert('Web Speech API not supported in this browser. Please use the Quick Preset buttons below!');
      }
    }
  };

  // Preset Scenarios (Fail-Safe for Fair)
  const loadScenario = (type: string) => {
    if (type === 'fever') {
      setTranscript("Patient complains in Banglish: 'Kalke theke onek jor 102 degree, shathe matha ghora, r pet fape ase, buke jala pora.' Doctor examines: BP is 120/80 mmHg, pulse 84 bpm. Doctor says: 'Apnake Napa Extra dichhi dine 2 bar khabar por 5 din, r Seclo 20 shokale r rate khabar 20 min age 14 din. Monas 10 ekta kore rate khaben. Pani r shorbot beshi kore khaben.'");
    } else if (type === 'diabetes') {
      setTranscript("Known diabetic patient, fasting blood sugar 9.2 mmol/L, BP 145/95 mmHg. Complains of generalized fatigue, blurred vision and leg pain. Doctor prescribes Diapro 500 twice daily with meals, Bizoran 5/20 at bedtime, and Atova 10 at night. Continue regular exercise, low carb diet.");
    } else if (type === 'interaction') {
      setTranscript("Critical Safety Check Case: 65-year-old cardiac patient on long-term Warfarin therapy for atrial fibrillation. Doctor inadvertently prescribes Aspirin 75mg daily along with Ciprocin 500mg and Napa.");
    }
  };

  // Real Neural AI Processing (Calls Gemini 3.5 Flash via C# API)
  const handleAnalyzeConsultation = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    setWarnings([]);

    try {
      const res = await fetch(`${API_BASE}/ai/analyze-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      const data = await res.json();

      if (data) {
        if (data.vitals) setVitals(data.vitals);
        if (data.chiefComplaints) setComplaints(data.chiefComplaints);
        if (data.diagnosis) setDiagnosis(data.diagnosis);
        if (data.medicines && data.medicines.length > 0) setMedicines(data.medicines);
        if (data.investigations) setInvestigations(data.investigations);
        if (data.adviceBangla) setAdvice(data.adviceBangla);
        if (data.interactionWarnings) setWarnings(data.interactionWarnings);
        if (data.model) setAiMeta(data.model);
        if (data.executionTimeMs) setExecutionTime(data.executionTimeMs);
      }
    } catch (err) {
      console.error('AI Inference Error:', err);
      alert('AI inference call failed. Please check backend connection.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add Medicine from search
  const handleAddMedicine = (med: any) => {
    const newItem: PrescriptionItem = {
      medicineId: med.id,
      brandName: med.brand_name,
      genericName: med.generic_name,
      form: med.form,
      strength: med.strength,
      dosagePattern: med.standard_dosage || '1+0+1',
      duration: '7 days',
      instructionsBangla: med.instructions_bangla || 'খাওয়ার পরে'
    };
    const updated = [...medicines, newItem];
    setMedicines(updated);
    setSearchQuery('');
    setSearchResults([]);
    checkInteractions(updated);
  };

  const handleDeleteMedicine = (index: number) => {
    const updated = medicines.filter((_, i) => i !== index);
    setMedicines(updated);
    checkInteractions(updated);
  };

  const checkInteractions = async (medList: PrescriptionItem[]) => {
    try {
      const generics = medList.map(m => m.genericName);
      const res = await fetch(`${API_BASE}/interactions/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genericNames: generics })
      });
      const data = await res.json();
      if (data && data.warnings) {
        setWarnings(data.warnings);
      } else {
        setWarnings([]);
      }
    } catch (err) {}
  };

  // Save Prescription
  const handleSavePrescription = async () => {
    setIsSaving(true);
    try {
      const payload = {
        doctorId: selectedDoctor?.id || 1,
        patientId: selectedPatient?.id || 1,
        chiefComplaints: complaints,
        vitals: vitals,
        diagnosis: diagnosis,
        investigations: investigations,
        adviceBangla: advice,
        interactionWarnings: warnings.map(w => `${w.drugA} + ${w.drugB}: ${w.description}`),
        items: medicines
      };

      const res = await fetch(`${API_BASE}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.rxNumber) {
        setSavedRxNumber(data.rxNumber);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      setSavedRxNumber(`RX-${Date.now().toString().slice(-6)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Text-to-Speech in Bangla
  const speakBangla = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'bn-BD';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech not supported in this browser.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* TOP NAVBAR */}
      <header className="no-print" style={{ 
        background: '#0F52BA', 
        color: '#FFFFFF', 
        padding: '12px 24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.15)', 
            padding: '8px', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Stethoscope size={26} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                BanglaRx AI™
              </h1>
              <span style={{ 
                fontSize: '0.7rem', 
                background: '#00A86B', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontWeight: '700'
              }}>
                R&D EDITION
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', opacity: 0.85 }}>
              Ambient Clinical Intelligence & Smart Prescription Guardian (DCCI AI Fair)
            </p>
          </div>
        </div>

        {/* AI Model Badge & System Live Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          
          {/* Active Neural Network Badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(255,255,255,0.18)', 
            padding: '6px 14px', 
            borderRadius: '20px',
            fontSize: '0.8rem',
            border: '1px solid rgba(255,255,255,0.25)'
          }}>
            <Cpu size={15} color="#67E8F9" />
            <span>AI: <strong>Gemini 3.5 Flash Neural Engine</strong></span>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'rgba(255,255,255,0.12)', 
            padding: '6px 12px', 
            borderRadius: '20px',
            fontSize: '0.78rem'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#10B981',
              display: 'inline-block' 
            }} />
            <span>PostgreSQL 18: <strong>BanglaRxDB</strong></span>
          </div>

          <button 
            onClick={() => setShowQrModal(true)}
            style={{ 
              background: '#FFFFFF', 
              color: '#0F52BA', 
              border: 'none', 
              padding: '7px 16px', 
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <QrCode size={16} /> Patient Mobile View
          </button>
        </div>
      </header>

      {/* DOCTOR & PATIENT SELECTOR BAR */}
      <div className="no-print" style={{ 
        background: '#FFFFFF', 
        borderBottom: '1px solid #E2E8F0', 
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Doctor Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="#0F52BA" />
            <span style={{ color: '#64748B', fontWeight: '500' }}>Physician:</span>
            <select 
              value={selectedDoctor?.id || ''} 
              onChange={e => {
                const doc = doctors.find(d => d.id === parseInt(e.target.value));
                if (doc) setSelectedDoctor(doc);
              }}
              style={{ 
                padding: '4px 8px', 
                borderRadius: '6px', 
                border: '1px solid #CBD5E1',
                fontWeight: '600',
                color: '#1E293B',
                background: '#F8FAFC'
              }}
            >
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
              ))}
            </select>
          </div>

          {/* Patient Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="#00A86B" />
            <span style={{ color: '#64748B', fontWeight: '500' }}>Patient:</span>
            <select 
              value={selectedPatient?.id || ''} 
              onChange={e => {
                const pat = patients.find(p => p.id === parseInt(e.target.value));
                if (pat) setSelectedPatient(pat);
              }}
              style={{ 
                padding: '4px 8px', 
                borderRadius: '6px', 
                border: '1px solid #CBD5E1',
                fontWeight: '600',
                color: '#1E293B',
                background: '#F8FAFC'
              }}
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.age}y/{p.gender[0]}) — {p.patient_uid}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => window.print()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 14px', 
              borderRadius: '6px', 
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              fontWeight: '600',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            <Printer size={15} /> Print Rx Pad
          </button>

          <button 
            onClick={handleSavePrescription}
            disabled={isSaving}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 16px', 
              borderRadius: '6px', 
              border: 'none',
              background: saveSuccess ? '#00A86B' : '#0F52BA',
              color: '#FFFFFF',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <CheckCircle2 size={15} />
            {saveSuccess ? 'Signed & Stored!' : isSaving ? 'Saving...' : 'Sign & Save Rx'}
          </button>
        </div>
      </div>

      {/* MAIN SPLIT-SCREEN WORKSPACE */}
      <div style={{ 
        flex: 1, 
        display: 'grid', 
        gridTemplateColumns: '42% 58%', 
        padding: '20px', 
        gap: '20px',
        maxWidth: '1650px',
        margin: '0 auto',
        width: '100%'
      }}>

        {/* LEFT COLUMN: AMBIENT CONSULTATION & AI COPILOT */}
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Ambient Microphone Station */}
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
              <span style={{ 
                fontSize: '0.72rem', 
                background: isRecording ? '#FEE2E2' : '#EBF3FF',
                color: isRecording ? '#DC2626' : '#0F52BA',
                padding: '3px 10px',
                borderRadius: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  backgroundColor: isRecording ? '#DC2626' : '#0F52BA' 
                }} />
                {isRecording ? 'LIVE LISTENING...' : 'NEURAL READY'}
              </span>
            </div>

            {/* Big Mic Button & Visual Waveform */}
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
                onClick={toggleRecording}
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
                {isRecording ? 'Listening to doctor-patient conversation in real-time...' : 'Click mic to speak natural Bangla / English / Banglish'}
              </p>

              {/* Animated waveform bars when recording */}
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

            {/* Quick Presets for Fair Stall (Fail-Safe) */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                ⚡ Stall Showcase Presets (One-Click Rehearsal):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button 
                  onClick={() => loadScenario('fever')}
                  style={{ 
                    padding: '8px 10px', 
                    borderRadius: '8px', 
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#0F52BA',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  🌡️ 1. Banglish Fever & Acidity
                </button>

                <button 
                  onClick={() => loadScenario('diabetes')}
                  style={{ 
                    padding: '8px 10px', 
                    borderRadius: '8px', 
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#00A86B',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  🩺 2. Diabetes & BP Routine
                </button>

                <button 
                  onClick={() => loadScenario('interaction')}
                  style={{ 
                    padding: '8px 10px', 
                    borderRadius: '8px', 
                    border: '1px solid #FCA5A5',
                    background: '#FEF2F2',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#DC2626',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  ⚠️ 3. Warfarin + Aspirin DDI
                </button>
              </div>
            </div>

            {/* Speech Transcript Editor Box */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#475569' }}>
                  Doctor-Patient Speech Narrative (Unstructured Dialogue):
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
                placeholder="Doctor voice conversation or typed clinical narrative appears here..."
                rows={4}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Run AI Analysis Button */}
            <button 
              onClick={handleAnalyzeConsultation}
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

            {/* AI Architecture Subtitle */}
            <div style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center', marginTop: '8px' }}>
              Engine: <strong>{aiMeta}</strong>
            </div>
          </div>

          {/* Quick Medicine Search Dropdown */}
          <div style={{ 
            background: '#FFFFFF', 
            borderRadius: '12px', 
            padding: '16px', 
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Search size={16} color="#0F52BA" />
              <h3 style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1E293B' }}>
                Add Medicine (PostgreSQL Inventory Lookup)
              </h3>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Type brand name (e.g. Napa, Seclo, Monas, Fexo)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem'
                }}
              />

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  background: '#FFFFFF', 
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 20,
                  marginTop: '4px',
                  overflow: 'hidden'
                }}>
                  {searchResults.map(med => (
                    <div 
                      key={med.id} 
                      onClick={() => handleAddMedicine(med)}
                      style={{ 
                        padding: '8px 12px', 
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                    >
                      <div>
                        <strong>{med.brand_name}</strong> <span style={{ color: '#64748B' }}>({med.form} - {med.strength})</span>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{med.generic_name} • {med.manufacturer}</div>
                      </div>
                      <Plus size={16} color="#0F52BA" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: OFFICIAL DIGITAL HOSPITAL PRESCRIPTION PAD */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div className="rx-paper" style={{ 
            background: '#FFFFFF', 
            borderRadius: '12px', 
            boxShadow: 'var(--shadow-md)',
            border: '1px solid #E2E8F0',
            padding: '28px',
            minHeight: '800px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>

            <div>
              {/* HOSPITAL & DOCTOR HEADER */}
              <div style={{ 
                borderBottom: '2px solid #0F52BA', 
                paddingBottom: '16px', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0F52BA' }}>
                    {selectedDoctor?.name || 'Prof. Dr. M. A. Rahman'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
                    {selectedDoctor?.degrees || 'MBBS, FCPS (Medicine), MD (Cardiology)'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    {selectedDoctor?.specialization || 'Medicine & Interventional Cardiology'}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                    BMDC Reg. No: <strong>{selectedDoctor?.bmdc_reg_no || 'A-45982'}</strong> | {selectedDoctor?.hospital_name || 'Dhaka Medical College & Hospital'}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '800', 
                    color: '#0F52BA',
                    letterSpacing: '0.05em' 
                  }}>
                    E-PRESCRIPTION
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
                    Rx No: <strong>{savedRxNumber}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong>
                  </div>
                </div>
              </div>

              {/* PATIENT DEMOGRAPHICS BAR */}
              <div style={{ 
                background: '#F8FAFC', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                marginTop: '14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                fontSize: '0.8rem',
                gap: '8px'
              }}>
                <div><span style={{ color: '#64748B' }}>Patient:</span> <strong>{selectedPatient?.full_name || 'Md. Kabir Hossain'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Age / Sex:</span> <strong>{selectedPatient?.age || 45}Y / {selectedPatient?.gender || 'Male'}</strong></div>
                <div><span style={{ color: '#64748B' }}>UID:</span> <strong>{selectedPatient?.patient_uid || 'PAT-2026-001'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Blood Grp:</span> <strong>{selectedPatient?.blood_group || 'B+'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Phone:</span> <strong>{selectedPatient?.phone || '+8801819000111'}</strong></div>
              </div>

              {/* VITALS STRIP */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                marginTop: '10px', 
                padding: '6px 14px', 
                background: '#EBF3FF', 
                borderRadius: '6px',
                fontSize: '0.78rem'
              }}>
                <HeartPulse size={15} color="#0F52BA" />
                <span>BP: <strong>{vitals.bp}</strong></span>
                <span>•</span>
                <span>Temp: <strong>{vitals.temp}</strong></span>
                <span>•</span>
                <span>Pulse: <strong>{vitals.pulse}</strong></span>
              </div>

              {/* DRUG-TO-DRUG INTERACTION ALERT BANNER (CRITICAL SAFETY GUARDIAN) */}
              {warnings.length > 0 && (
                <div style={{ 
                  marginTop: '14px', 
                  background: '#FEF2F2', 
                  border: '1px solid #FCA5A5', 
                  borderRadius: '8px', 
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <ShieldAlert size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      CLINICAL DRUG-DRUG INTERACTION ALERT ({warnings.length} detected)
                    </div>
                    {warnings.map((w, idx) => (
                      <div key={idx} style={{ fontSize: '0.78rem', color: '#7F1D1D', marginTop: '4px' }}>
                        <strong>{w.drugA} + {w.drugB} ({w.severity}):</strong> {w.description}
                        <div style={{ fontStyle: 'italic', color: '#B91C1C', marginTop: '2px' }}>
                          💡 Clinical Guidance: {w.clinicalAdvice}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRESCRIPTION BODY: LEFT (COMPLAINTS/DIAGNOSIS) & RIGHT (Rx MEDICATIONS) */}
              <div style={{ display: 'grid', gridTemplateColumns: '30% 70%', marginTop: '16px', gap: '20px' }}>
                
                {/* Clinical Notes (Left) */}
                <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: '14px' }}>
                  
                  {/* Complaints */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Chief Complaints:
                    </div>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', color: '#334155' }}>
                      {complaints.map((c, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Diagnosis */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Clinical Diagnosis:
                    </div>
                    <div style={{ 
                      fontSize: '0.82rem', 
                      fontWeight: '700', 
                      color: '#0F52BA', 
                      background: '#F0F9FF', 
                      padding: '6px 8px', 
                      borderRadius: '6px' 
                    }}>
                      {diagnosis}
                    </div>
                  </div>

                  {/* Investigations */}
                  {investigations.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Investigations (Tests):
                      </div>
                      <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: '#475569' }}>
                        {investigations.map((inv, i) => (
                          <li key={i} style={{ marginBottom: '3px' }}>{inv}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>

                {/* Rx Medications Grid (Right) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0F52BA', fontStyle: 'italic' }}>
                      ℞
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Prescribed Medications (Grounded with DB):
                    </span>
                  </div>

                  {/* Medicine Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {medicines.map((med, index) => (
                      <div 
                        key={index} 
                        style={{ 
                          padding: '10px 14px', 
                          borderRadius: '8px', 
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              background: '#F1F5F9', 
                              color: '#475569', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              fontWeight: '700' 
                            }}>
                              {med.form}
                            </span>
                            <strong style={{ fontSize: '0.9rem', color: '#1E293B' }}>{med.brandName}</strong>
                            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>({med.strength})</span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                            {med.genericName}
                          </div>

                          {/* Bengali Dosage Instruction */}
                          <div className="bangla-text" style={{ 
                            fontSize: '0.85rem', 
                            color: '#0F52BA', 
                            fontWeight: '600', 
                            marginTop: '4px' 
                          }}>
                            {med.dosagePattern} — {med.duration} ({med.instructionsBangla})
                          </div>
                        </div>

                        {/* Delete button (no-print) */}
                        <button 
                          className="no-print"
                          onClick={() => handleDeleteMedicine(index)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#94A3B8', 
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                          onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bengali Advice Box */}
                  <div style={{ marginTop: '16px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div className="bangla-text" style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                        পরামর্শ (Patient Instructions in Bengali):
                      </div>
                      <button 
                        className="no-print"
                        onClick={() => speakBangla(advice.join('. '))}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          background: '#EBF3FF', 
                          border: 'none', 
                          color: '#0F52BA', 
                          padding: '3px 8px', 
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          cursor: 'pointer' 
                        }}
                      >
                        <Volume2 size={13} /> বাংলায় শুনুন (Voice Readout)
                      </button>
                    </div>

                    <ul className="bangla-text" style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#475569' }}>
                      {advice.map((adv, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>{adv}</li>
                      ))}
                    </ul>
                  </div>

                </div>

              </div>
            </div>

            {/* PRESCRIPTION FOOTER: SIGNATURE & DISCLAIMER */}
            <div style={{ 
              borderTop: '1px solid #E2E8F0', 
              paddingTop: '14px', 
              marginTop: '24px', 
              display: 'flex', 
              alignItems: 'flex-end', 
              justifyContent: 'space-between' 
            }}>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Generated via <strong>BanglaRx AI Engine</strong>. Verified by Attending Physician.<br />
                Powered by Google Gemini Neural Foundation & PostgreSQL 18 RAG.
              </div>

              {/* Digital Doctor Signature */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontFamily: 'cursive', 
                  fontSize: '1.1rem', 
                  color: '#0F52BA',
                  borderBottom: '1px dashed #94A3B8',
                  paddingBottom: '2px',
                  marginBottom: '4px'
                }}>
                  {selectedDoctor?.name || 'Dr. M. A. Rahman'}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748B' }}>
                  Registered Medical Practitioner
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* PATIENT MOBILE QR CODE MODAL (HIGH WOW FACTOR FOR FAIR STALL) */}
      {showQrModal && (
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
              Rx Number: {savedRxNumber} • {medicines.length} Medicines Prescribed
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => {
                  speakBangla("আপনার প্রেসক্রিপশন তৈরি হয়েছে। ডাক্তারের পরামর্শ অনুযায়ী সময়মতো ওষুধ গ্রহণ করুন।");
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
                onClick={() => setShowQrModal(false)}
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
      )}

    </div>
  );
}

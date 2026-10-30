import React, { useState, useEffect, useRef } from 'react';
import type { Doctor, Patient, PrescriptionItem, SafetyAlert, AccuracyMetrics, QueueItem, GeneralSigns, MedicineOption } from './types/index';
import { Navbar } from './components/Navbar';
import { PatientCard } from './components/PatientCard';
import { VoiceConsultation } from './components/VoiceConsultation';
import { AccuracyAnalytics } from './components/AccuracyAnalytics';
import { MedicineSearch } from './components/MedicineSearch';
import { PrescriptionPad } from './components/PrescriptionPad';
import { PatientQrModal } from './components/PatientQrModal';
import { StackInfoModal } from './components/StackInfoModal';
import { DoctorProfileModal } from './components/DoctorProfileModal';
import { QueuePage } from './pages/QueuePage';
import { RegistrationPage } from './pages/RegistrationPage';
import { DashboardPage } from './pages/DashboardPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { BookingsPage } from './pages/BookingsPage';
import { InboxPage } from './pages/InboxPage';
import { SathiPanel } from './components/SathiPanel';
import { PatientReportsCard } from './components/PatientReportsCard';
import { Button, Callout, LinkButton } from './design-system';
import { getSession } from './auth/session';
import { API_BASE } from './api';
import { Info } from 'lucide-react';


export default function App() {
  // Domain Data State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  // what the patient said about recording the visit: agreed / declined / not_asked
  const [sathiOpen, setSathiOpen] = useState(false);
  const [recordConsent, setRecordConsent] = useState<'agreed' | 'declined' | 'not_asked'>('not_asked');
  useEffect(() => {
    setRecordConsent('not_asked');
    if (!selectedPatient?.id) return;
    let live = true;
    fetch(`${API_BASE}/patients/${selectedPatient.id}/consent`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.recordVisit) setRecordConsent(d.recordVisit); })
      .catch(() => {});
    return () => { live = false; };
  }, [selectedPatient?.id]);

  // Chamber Queue State (The Full Operational Picture)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  // Page routing: '#/' workbench, '#/queue' chamber queue, '#/register' new patient
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [isDoctorProfileOpen, setIsDoctorProfileOpen] = useState(false);

  // Audio & Input State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMeta, setAiMeta] = useState('BanglaRx AI™ Clinical Assistant');
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [speechLanguage, setSpeechLanguage] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [isAmendmentMode, setIsAmendmentMode] = useState(false);

  // Accuracy & Clinical Summary State
  const [accuracyMetrics, setAccuracyMetrics] = useState<AccuracyMetrics | null>(null);

  // Prescription State — starts EMPTY: nothing is pre-filled that the doctor/triage did not record
  const [vitals, setVitals] = useState<{ bp?: string; temp?: string; pulse?: string; spo2?: string; height?: string; weight?: string }>({});
  const [complaints, setComplaints] = useState<string[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<PrescriptionItem[]>([]);
  const [investigations, setInvestigations] = useState<string[]>([]);
  const [patientReportsPresented, setPatientReportsPresented] = useState<string[]>([]);
  const [advice, setAdvice] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState('');
  const [emergencyRedFlags, setEmergencyRedFlags] = useState('');
  const [referredTo, setReferredTo] = useState('');
  const [generalSigns, setGeneralSigns] = useState<GeneralSigns>({});
  const [examNotes, setExamNotes] = useState('');
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string; payload: any }[]>([]);
  const [savedRxId, setSavedRxId] = useState<number | null>(null);
  const [rxVersion, setRxVersion] = useState(1);

  // UI Controls
  const [showQrModal, setShowQrModal] = useState(false);
  const [showStackModal, setShowStackModal] = useState(false);
  const [savedRxNumber, setSavedRxNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const accumulatedTranscriptRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize Doctors, Patients & Live Queue
  useEffect(() => {
    fetch(`${API_BASE}/doctors`)
      .then(r => r.json())
      .then(all => {
        // a doctor (or the assistant working for one) only ever sees their own chamber
        const mine = getSession()?.user.doctorId;
        const d: Doctor[] = !Array.isArray(all) ? [] : mine ? all.filter((x: Doctor) => x.id === mine) : all;
        setDoctors(d);
        if (d.length > 0) {
          setSelectedDoctor(d[0]);
          fetchQueue(d[0].id);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/patients`)
      .then(r => r.json())
      .then(p => {
        setPatients(p);
        if (p.length > 0) setSelectedPatient(p[0]);
      })
      .catch(() => {});
  }, []);

  // Fetch Queue helper
  const fetchQueue = async (docId?: number) => {
    try {
      const id = docId || selectedDoctor?.id || 1;
      const res = await fetch(`${API_BASE}/queue?doctorId=${id}`);
      const data = await res.json();
      if (Array.isArray(data)) setQueue(data);
    } catch (e) {
      console.error('Failed to fetch queue:', e);
    }
  };

  // The queue changes while you are on other pages (a booking arrives, the front desk registers someone):
  // reload it every time you move between pages, so what you open is never stale.
  useEffect(() => {
    if (selectedDoctor) fetchQueue(selectedDoctor.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Medicine Search Autocomplete
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      fetch(`${API_BASE}/medicines?q=${encodeURIComponent(searchQuery)}&limit=6`)
        .then(r => r.json())
        .then(data => setSearchResults(data))
        .catch(() => {});
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Speech Recognition with Continuous Ambient Listening Keep-Alive
  const startSpeechEngine = (lang: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech API not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      isRecordingRef.current = false;
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulatedTranscriptRef.current += piece + ' ';
        } else {
          interim += piece;
        }
      }
      setTranscript(accumulatedTranscriptRef.current + interim);
    };

    recognition.onerror = (event: any) => {
      // Normal conversational pauses produce 'no-speech'; ignore and keep alive
      if (event.error === 'not-allowed') {
        isRecordingRef.current = false;
        setIsRecording(false);
        alert('Microphone access was denied. Please allow microphone permissions in your browser.');
      }
    };

    recognition.onend = () => {
      // Auto-restart keepalive loop if ambient listening is still enabled
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          setTimeout(() => {
            if (isRecordingRef.current) {
              try { recognition.start(); } catch {}
            }
          }, 200);
        }
      } else {
        setIsRecording(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      console.warn('Speech engine start deferred:', err);
    }
  };

  const toggleRecording = () => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsRecording(false);
    } else {
      if (recordConsent === 'declined') return;
      isRecordingRef.current = true;
      accumulatedTranscriptRef.current = transcript ? transcript.trim() + ' ' : '';
      startSpeechEngine(speechLanguage);
    }
  };

  const handleLanguageChange = (newLang: 'bn-BD' | 'en-US') => {
    setSpeechLanguage(newLang);
    if (isRecordingRef.current) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setTimeout(() => {
        if (isRecordingRef.current) {
          startSpeechEngine(newLang);
        }
      }, 150);
    }
  };

  // Abort / Cancel AI Generation
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
  };

  // Demo Scenarios & Voice Edit Prompts
  const loadScenario = (type: string) => {
    if (type === 'bangla_pure') {
      setSpeechLanguage('bn-BD');
      setTranscript("রোগীর গত ৩ দিন ধরে অনেক জ্বর, ১০২ ডিগ্রি। সাথে মাথা ঘোরা এবং পেটে গ্যাস ও বুক জ্বালাপোড়া। ডাক্তার বললেন নাপা এক্সট্রা দিনে দুইবার খাওয়ার পরে খাবেন ৫ দিন, আর সেকলো ২০ সকালে ও রাতে খাওয়ার ২০ মিনিট আগে ১৪ দিন। ডাবের পানি বেশি করে পান করবেন।");
    } else if (type === 'fever') {
      setSpeechLanguage('en-US');
      setTranscript("Patient complains in Banglish: 'Amar kalke theke onek jor 102 degree, shathe matha ghora, r pet fape ase, buke jala pora.' Doctor examines: BP is 120/80 mmHg, pulse 84 bpm. Doctor says: 'Apnake Napa Extra dichhi dine 2 bar khabar por 5 din, r Seclo 20 shokale r rate khabar 20 min age 14 din. Monas 10 ekta kore rate khaben. Pani r shorbot beshi kore khaben.'");
    } else if (type === 'diabetes') {
      setSpeechLanguage('en-US');
      setTranscript("Known diabetic patient, fasting blood sugar 9.2 mmol/L, BP 145/95 mmHg. Complains of generalized fatigue, blurred vision and leg pain. Doctor prescribes Diapro 500 twice daily with meals, Bizoran 5/20 at bedtime, and Atova 10 at night. Continue regular exercise, low carb diet.");
    } else if (type === 'interaction') {
      setSpeechLanguage('en-US');
      setTranscript("Critical Safety Check Case: 65-year-old cardiac patient on long-term Warfarin therapy for atrial fibrillation. Doctor inadvertently prescribes Aspirin 75mg daily along with Ciprocin 500mg and Napa.");
    } else if (type === 'edit_interval') {
      setTranscript("Doctor amendment: Change Napa dosage to every 4 hours instead of 3 times daily, for 3 days, and add Tab. Monas 10mg at bedtime.");
    } else if (type === 'edit_add_med') {
      setTranscript("Doctor amendment: Add Tab. Monas 10mg one tablet at bedtime for 14 days, and advise Dengue NS1 test.");
    }
  };

  // Analyze Consultation Dialogue or Apply Voice Amendment
  const handleAnalyzeConsultation = async () => {
    if (!transcript.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessing(true);
    setSafetyAlerts([]);

    try {
      const hasActiveMeds = medicines && medicines.length > 0;
      const res = await fetch(`${API_BASE}/ai/analyze-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          patientId: selectedPatient?.id,
          weightKg: vitals.weight,
          isAmendment: hasActiveMeds,
          currentPrescriptionJson: hasActiveMeds ? JSON.stringify(medicines) : null
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Inference returned HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data) {
        // Merge: AI only fills what it actually heard; empty never wipes triage vitals or doctor's edits
        if (data.vitals && Object.keys(data.vitals).length > 0) setVitals(prev => ({ ...prev, ...data.vitals }));
        if (data.chiefComplaints && data.chiefComplaints.length > 0) setComplaints(data.chiefComplaints);
        if (data.diagnosis) setDiagnosis(data.diagnosis);
        if (data.medicines && data.medicines.length > 0) setMedicines(data.medicines);
        if (data.investigations && data.investigations.length > 0) setInvestigations(data.investigations);
        if (data.patientReportsPresented && data.patientReportsPresented.length > 0) {
          setPatientReportsPresented(data.patientReportsPresented);
        }
        if (data.adviceBangla && data.adviceBangla.length > 0) setAdvice(data.adviceBangla);
        if (data.followUp) setFollowUp(data.followUp);
        if (data.emergencyRedFlags) setEmergencyRedFlags(data.emergencyRedFlags);
        if (data.safetyAlerts) setSafetyAlerts(data.safetyAlerts);
        if (data.executionTimeMs) setExecutionTime(data.executionTimeMs);

        // Real counts only (no invented confidence figures)
        setAccuracyMetrics({
          unmatchedMedicines: data.unmatchedMedicineCount || 0,
          detectedCategories: {
            symptoms: data.chiefComplaints?.length || 0,
            vitals: Object.keys(data.vitals || {}).length,
            medications: data.medicines?.length || 0,
            instructions: data.adviceBangla?.length || 0
          }
        });

        // Reset transcript after successful synthesis / amendment
        setTranscript('');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Prescription generation canceled by doctor.');
        return;
      }
      console.error('Clinical Inference Error:', err);
      alert('Clinical inference call failed. Please verify that the backend API is online.');
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // Direct In-Pad Medicine Editing
  const handleUpdateMedicine = (index: number, field: keyof PrescriptionItem, value: string) => {
    setMedicines(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Add / Remove Medicine
  const handleAddMedicine = (med: any) => {
    const newItem: PrescriptionItem = {
      medicineId: med.id,
      brandName: med.brand_name,
      genericName: med.generic_name,
      form: med.form,
      strength: med.strength,
      dosagePattern: med.standard_dosage || '',
      duration: '',
      instructionsBangla: med.instructions_bangla || ''
    };
    const updated = [...medicines, newItem];
    setMedicines(updated);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ---- Speed features: repeat last visit, templates, keyboard shortcuts ----
  const stripMatch = (m: PrescriptionItem): PrescriptionItem => ({ ...m, matchStatus: undefined, matchOptions: undefined });

  const loadTemplates = async (doctorId?: number) => {
    if (!doctorId) return;
    try {
      const res = await fetch(`${API_BASE}/templates?doctorId=${doctorId}`);
      const data = await res.json();
      if (Array.isArray(data)) setTemplates(data);
    } catch { /* offline */ }
  };

  useEffect(() => { loadTemplates(selectedDoctor?.id); }, [selectedDoctor?.id]);

  const handleRepeatLast = async () => {
    if (!selectedPatient) return;
    try {
      const res = await fetch(`${API_BASE}/prescriptions/latest?patientId=${selectedPatient.id}&doctorId=${selectedDoctor?.id ?? ''}`);
      if (res.status === 404) { alert('No previous prescription found for this patient.'); return; }
      const data = await res.json();
      const rx = data.prescription;
      // New visit: copy treatment plan only. Vitals, complaints and exam findings are NOT carried over.
      setMedicines((data.items || []).map(stripMatch));
      if (rx.diagnosis) setDiagnosis(rx.diagnosis);
      if (rx.investigations?.length) setInvestigations(rx.investigations);
      if (rx.advice_bangla?.length) setAdvice(rx.advice_bangla);
      if (rx.follow_up) setFollowUp(rx.follow_up);
    } catch {
      alert('Could not load the last prescription.');
    }
  };

  const handleApplyTemplate = (id: number) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    const pl = t.payload || {};
    if (Array.isArray(pl.medicines)) setMedicines(prev => [...prev, ...pl.medicines.map(stripMatch)]);
    if (Array.isArray(pl.investigations)) setInvestigations(prev => Array.from(new Set([...prev, ...pl.investigations])));
    if (Array.isArray(pl.advice)) setAdvice(prev => Array.from(new Set([...prev, ...pl.advice])));
    if (pl.diagnosis && !diagnosis) setDiagnosis(pl.diagnosis);
  };

  const handleSaveTemplate = async () => {
    if (!selectedDoctor || medicines.length === 0) return;
    const name = window.prompt('Template name (e.g. Viral fever):');
    if (!name || !name.trim()) return;
    try {
      await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          name: name.trim(),
          payload: { diagnosis, medicines: medicines.map(stripMatch), investigations, advice }
        })
      });
      loadTemplates(selectedDoctor.id);
    } catch {
      alert('Could not save the template.');
    }
  };

  // Shortcuts: Ctrl+S = sign/save, "/" = jump to medicine search
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => { saveRef.current = handleSavePrescription; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      } else if (e.key === '/') {
        const el = e.target as HTMLElement;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        e.preventDefault();
        document.getElementById('medicine-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Doctor picks the exact formulary product when the AI was unsure
  const handleChooseMedicine = (index: number, opt: MedicineOption) => {
    setMedicines(prev => prev.map((m, i) => i !== index ? m : {
      ...m,
      medicineId: opt.id,
      brandName: opt.brandName,
      genericName: opt.genericName,
      form: opt.form,
      strength: opt.strength,
      matchStatus: 'exact',
      matchOptions: undefined
    }));
  };

  const handleDeleteMedicine = (index: number) => {
    const updated = medicines.filter((_, i) => i !== index);
    setMedicines(updated);
  };

  // In-Pad Investigation Add / Remove
  const handleAddInvestigation = (test: string) => {
    if (!investigations.includes(test)) {
      setInvestigations(prev => [...prev, test]);
    }
  };

  const handleDeleteInvestigation = (index: number) => {
    setInvestigations(prev => prev.filter((_, i) => i !== index));
  };

  // Safety engine: allergy / duplicate / interaction / dose — re-checked whenever meds, patient or weight change
  useEffect(() => {
    if (medicines.length === 0) { setSafetyAlerts([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/safety/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatient?.id,
            allergies: selectedPatient?.allergies,
            age: selectedPatient?.age,
            weightKg: vitals.weight,
            items: medicines
          })
        });
        const data = await res.json();
        setSafetyAlerts(data?.alerts || []);
      } catch { /* backend offline: keep previous alerts */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [medicines, selectedPatient, vitals.weight]);

  // Save Prescription
  const handleSavePrescription = async () => {
    const incomplete = medicines.filter(m => !m.dosagePattern || !m.duration);
    if (incomplete.length > 0 && !window.confirm(`${incomplete.map(m => m.brandName).join(', ')}: dosage or duration is not set. Save anyway?`)) return;
    setIsSaving(true);
    try {
      const payload = {
        doctorId: selectedDoctor?.id || 1,
        patientId: selectedPatient?.id || 1,
        chiefComplaints: complaints,
        vitals,
        diagnosis,
        investigations,
        adviceBangla: advice,
        interactionWarnings: safetyAlerts.map(a => `${a.type.toUpperCase()} (${a.severity}): ${a.title}`),
        items: medicines,
        followUp,
        referredTo,
        generalSigns: Object.fromEntries(Object.entries(generalSigns).filter(([, v]) => v)),
        examNotes,
        redFlags: emergencyRedFlags,
        patientReports: patientReportsPresented
      };

      // Already saved this encounter -> update it (new version) instead of creating a duplicate
      const res = await fetch(savedRxId ? `${API_BASE}/prescriptions/${savedRxId}` : `${API_BASE}/prescriptions`, {
        method: savedRxId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`);
      const data = await res.json();
      if (data?.rxNumber) {
        setSavedRxNumber(data.rxNumber);
        setSavedRxId(data.prescriptionId);
        setRxVersion(data.version || 1);
        setSaveSuccess(true);

        // Mark current patient in queue as 'Completed'
        const currentQueueItem = queue.find(q => q.patient_id === selectedPatient?.id && q.status !== 'Completed');
        if (currentQueueItem) {
          await fetch(`${API_BASE}/queue/${currentQueueItem.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' })
          });
          fetchQueue(selectedDoctor?.id);
        }

        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Prescription save error:', err);
      alert('Prescription could NOT be saved. Please check the backend and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear the whole pad so nothing leaks from the previous patient / doctor
  const resetPad = () => {
    setVitals({});
    setComplaints([]);
    setDiagnosis('');
    setMedicines([]);
    setInvestigations([]);
    setPatientReportsPresented([]);
    setAdvice([]);
    setFollowUp('');
    setEmergencyRedFlags('');
    setReferredTo('');
    setGeneralSigns({});
    setExamNotes('');
    setSafetyAlerts([]);
    setAccuracyMetrics(null);
    setSavedRxId(null);
    setRxVersion(1);
    setSavedRxNumber('');
    setTranscript('');
  };

  // Select patient from queue into active consultation
  const handleSelectPatientFromQueue = async (item: QueueItem) => {
    const matched = patients.find(p => p.id === item.patient_id) || {
      id: item.patient_id,
      patient_uid: item.patient_uid,
      full_name: item.patient_name,
      age: item.patient_age,
      gender: item.patient_gender,
      phone: item.patient_phone,
      blood_group: item.patient_blood_group,
      allergies: item.patient_allergies || 'Not recorded',
      chronic_conditions: item.patient_chronic || 'Not recorded'
    };
    setSelectedPatient(matched);

    // New patient -> clean pad (no leakage from previous patient)
    resetPad();

    // Load only the triage vitals that were actually recorded
    const vitalsObj = typeof item.triage_vitals === 'string'
      ? JSON.parse(item.triage_vitals || '{}')
      : item.triage_vitals || {};
    setVitals(vitalsObj);

    if (item.chief_complaint) {
      setComplaints([item.chief_complaint]);
    }

    // Update status in queue
    try {
      await fetch(`${API_BASE}/queue/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'In Consultation' })
      });
      fetchQueue(selectedDoctor?.id);
    } catch {}
  };

  // 1-Click "Call Next Waiting Patient" Workflow
  const handleCallNextPatient = async () => {
    const activeItem = queue.find(q => q.patient_id === selectedPatient?.id && q.status === 'In Consultation');
    if (activeItem) {
      await fetch(`${API_BASE}/queue/${activeItem.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      });
    }

    const nextWaiting = queue.find(q => q.status === 'Waiting');
    if (nextWaiting) {
      await handleSelectPatientFromQueue(nextWaiting);
    } else {
      alert("All waiting patients in today's chamber queue have been completed!");
      fetchQueue(selectedDoctor?.id);
    }
  };

  // When Reception Registers a New Patient
  const handlePatientRegistered = (newPat: Patient) => {
    setPatients(prev => [newPat, ...prev]);
    fetchQueue(selectedDoctor?.id);
    setSelectedPatient(newPat);
    resetPad();
  };

  // Handle Doctor Switch with Full Chamber & Pad Queue Isolation
  const handleDoctorSwitch = (doc: Doctor) => {
    setSelectedDoctor(doc);
    fetchQueue(doc.id);
    // Clear active prescription pad for strict multi-doctor chamber isolation
    resetPad();
  };

  // When Doctor Profile is Edited
  const handleDoctorUpdated = (updatedDoc: Doctor) => {
    setDoctors(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    setSelectedDoctor(updatedDoc);
  };

  // Voice Readout in Bangla
  const speakBangla = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'bn-BD';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const waitingCount = queue.filter(q => q.status === 'Waiting').length;
  const activeQueueItem = queue.find(q => q.patient_id === selectedPatient?.id && q.status !== 'Completed');

  // ---- Manager overview and pharmacy lookup (read-only pages) ----
  if (route.startsWith('#/dashboard')) return <DashboardPage doctors={doctors} />;
  if (route.startsWith('#/pharmacy')) return <PharmacyPage />;
  if (route.startsWith('#/schedules')) return <SchedulesPage />;
  if (route.startsWith('#/bookings')) return <BookingsPage />;
  if (route.startsWith('#/inbox')) return <InboxPage />;

  // ---- Queue page: today's chamber queue ----
  if (route.startsWith('#/queue')) {
    return (
      <QueuePage
        doctor={selectedDoctor}
        queue={queue}
        activePatientId={selectedPatient?.id || null}
        onSelectPatientFromQueue={handleSelectPatientFromQueue}
        onCallNextPatient={handleCallNextPatient}
      />
    );
  }

  // ---- Registration page: reception intake and token ----
  if (route.startsWith('#/register')) {
    return (
      <RegistrationPage
        queue={queue}
        doctorName={selectedDoctor?.name}
        roomNo={selectedDoctor?.room_no}
        onPatientRegistered={handlePatientRegistered}
        activeDoctorId={selectedDoctor?.id || 1}
      />
    );
  }

  // ---- Workbench: patient and voice on the left, the prescription on the right ----
  return (
    <div className="rx-page">
      <Navbar
        doctors={doctors}
        selectedDoctor={selectedDoctor}
        setSelectedDoctor={handleDoctorSwitch}
        queueCount={queue.length}
        waitingCount={waitingCount}
        onOpenDoctorProfile={() => setIsDoctorProfileOpen(true)}
      />

      <main className="rx-workbench">
        <aside className="rx-workbench__side no-print">
          <PatientCard
            patient={selectedPatient}
            patients={patients}
            queueItem={activeQueueItem}
            onSelectPatient={setSelectedPatient}
          />

          <PatientReportsCard patientId={selectedPatient?.id} onReviewed={(t) => setPatientReportsPresented((cur) => (cur.includes(t) ? cur : [...cur, t]))} />
          <Button variant="outlined" onClick={() => setSathiOpen(true)} title="Ask a clinical question about this patient">
            Ask Rx সাথী
          </Button>
          {recordConsent === 'declined' && (
            <Callout tone="danger" title="Patient declined recording">
              The microphone is off for this patient. You can still type notes below, or write the prescription by hand.
            </Callout>
          )}
          <VoiceConsultation
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            speechLanguage={speechLanguage}
            setSpeechLanguage={handleLanguageChange}
            transcript={transcript}
            setTranscript={setTranscript}
            onLoadScenario={loadScenario}
            onAnalyzeConsultation={handleAnalyzeConsultation}
            onCancelGeneration={handleCancelGeneration}
            isProcessing={isProcessing}
            executionTime={executionTime}
            aiMeta={aiMeta}
            isAmendmentMode={isAmendmentMode}
            setIsAmendmentMode={setIsAmendmentMode}
            hasExistingPrescription={medicines.length > 0}
          />
        </aside>

        <SathiPanel
          open={sathiOpen}
          onClose={() => setSathiOpen(false)}
          patient={selectedPatient}
          weightKg={vitals.weight}
          padItems={medicines}
          onAdd={(o) => handleAddMedicine({ id: o.id, brand_name: o.brandName, generic_name: o.genericName, form: o.form, strength: o.strength, standard_dosage: '', instructions_bangla: '' })}
        />

        <section className="rx-workbench__main">
          <AccuracyAnalytics metrics={accuracyMetrics} />

          <PrescriptionPad
            doctor={selectedDoctor}
            patient={selectedPatient}
            savedRxNumber={savedRxNumber}
            vitals={vitals}
            complaints={complaints}
            diagnosis={diagnosis}
            medicines={medicines}
            investigations={investigations}
            patientReportsPresented={patientReportsPresented}
            advice={advice}
            followUp={followUp}
            emergencyRedFlags={emergencyRedFlags}
            referredTo={referredTo}
            generalSigns={generalSigns}
            onUpdateGeneralSigns={(key, val) => setGeneralSigns(prev => ({ ...prev, [key]: val }))}
            examNotes={examNotes}
            onUpdateExamNotes={setExamNotes}
            rxVersion={rxVersion}
            rxId={savedRxId}
            isSavedRx={savedRxId !== null}
            safetyAlerts={safetyAlerts}
            onDeleteMedicine={handleDeleteMedicine}
            onChooseMedicine={handleChooseMedicine}
            templates={templates}
            onApplyTemplate={handleApplyTemplate}
            onSaveTemplate={handleSaveTemplate}
            onRepeatLast={handleRepeatLast}
            onUpdateMedicine={handleUpdateMedicine}
            onAddInvestigation={handleAddInvestigation}
            onDeleteInvestigation={handleDeleteInvestigation}
            onAddComplaint={comp => setComplaints(prev => [...prev, comp])}
            onDeleteComplaint={idx => setComplaints(prev => prev.filter((_, i) => i !== idx))}
            onUpdateDiagnosis={diag => setDiagnosis(diag)}
            onAddAdvice={adv => setAdvice(prev => [...prev, adv])}
            onDeleteAdvice={idx => setAdvice(prev => prev.filter((_, i) => i !== idx))}
            onUpdateFollowUp={setFollowUp}
            onUpdateReferredTo={ref => setReferredTo(ref)}
            onSpeakBangla={speakBangla}
            onOpenQrModal={() => setShowQrModal(true)}
            onSign={handleSavePrescription}
            isSigning={isSaving}
            signSuccess={saveSuccess}
            searchSlot={
              <MedicineSearch
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                onAddMedicine={handleAddMedicine}
              />
            }
          />
        </section>
      </main>

      <footer className="rx-appfoot no-print">
        <span>BanglaRx AI · Clinical decision support for Bangladesh · Grounded on the DGDA formulary</span>
        <span className="rx-row" style={{ gap: 4 }}>
          <LinkButton href="#/dashboard" variant="text">Overview</LinkButton>
          <LinkButton href="#/pharmacy" variant="text">Pharmacy</LinkButton>
          <Button variant="text" icon={<Info size={16} />} onClick={() => setShowStackModal(true)} title="System architecture and technical specifications">
            Architecture and stack
          </Button>
        </span>
      </footer>

      <PatientQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        savedRxNumber={savedRxNumber}
        medicinesCount={medicines.length}
        onSpeakBangla={speakBangla}
      />

      <StackInfoModal
        isOpen={showStackModal}
        onClose={() => setShowStackModal(false)}
      />

      <DoctorProfileModal
        isOpen={isDoctorProfileOpen}
        onClose={() => setIsDoctorProfileOpen(false)}
        doctor={selectedDoctor}
        onDoctorUpdated={handleDoctorUpdated}
        onDoctorCreated={newDoc => {
          setDoctors(prev => [...prev, newDoc]);
          handleDoctorSwitch(newDoc);
        }}
      />
    </div>
  );
}

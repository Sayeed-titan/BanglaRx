import React, { useState, useEffect } from 'react';
import { Check, Stethoscope } from 'lucide-react';
import type { Doctor } from '../types/index';
import { Button, Modal, SegmentedControl, TextField } from '../design-system';
import { API_BASE } from '../api';

interface DoctorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onDoctorUpdated: (updated: Doctor) => void;
  onDoctorCreated?: (newDoc: Doctor) => void;
}

const FORM_ID = 'doctor-profile-form';

export const DoctorProfileModal: React.FC<DoctorProfileModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onDoctorUpdated,
  onDoctorCreated,
}) => {
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [name, setName] = useState('');
  const [degrees, setDegrees] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [bmdcRegNo, setBmdcRegNo] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && doctor) {
      setName(doctor.name || '');
      setDegrees(doctor.degrees || '');
      setSpecialization(doctor.specialization || '');
      setBmdcRegNo(doctor.bmdc_reg_no || '');
      setHospitalName(doctor.hospital_name || '');
      setRoomNo(doctor.room_no || '');
      setPhone(doctor.phone || '');
      setEmail(doctor.email || '');
    } else if (mode === 'create') {
      setName('');
      setDegrees('MBBS, FCPS');
      setSpecialization('');
      setBmdcRegNo('A-');
      setHospitalName('Popular Diagnostic Center, Dhanmondi');
      setRoomNo('Room 302');
      setPhone('+880 1712-');
      setEmail('');
    }
  }, [doctor, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bmdcRegNo.trim()) {
      alert('Doctor name and BMDC registration number are mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        degrees,
        specialization,
        bmdc_reg_no: bmdcRegNo,
        hospital_name: hospitalName,
        room_no: roomNo,
        phone,
        email
      };

      if (mode === 'create') {
        const res = await fetch(`${API_BASE}/doctors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const created = await res.json();
        onDoctorCreated?.(created);
        onDoctorUpdated(created);
      } else {
        const res = await fetch(`${API_BASE}/doctors/${doctor?.id || 1}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: doctor?.id || 1 })
        });
        const updated = await res.json();
        onDoctorUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save doctor profile:', err);
      alert('Failed to save profile. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const creating = mode === 'create';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      icon={<Stethoscope size={22} aria-hidden="true" />}
      title="Chamber and doctor setup · চেম্বার ও ডাক্তার"
      subtitle="BMDC registration, chamber location and doctor management"
      footer={
        <>
          <Button variant="tonal" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} icon={<Check size={18} />} disabled={isSubmitting}>
            {isSubmitting ? (creating ? 'Registering doctor…' : 'Saving…') : creating ? 'Register and activate doctor' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="rx-stack">
        <SegmentedControl
          label="What would you like to do"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'edit', label: 'Edit active doctor' },
            { value: 'create', label: 'Add new doctor' },
          ]}
        />

        <TextField label={creating ? 'New doctor full name' : 'Doctor full name'} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Prof. Dr. Nazmul Islam" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <TextField label="Medical degrees" required value={degrees} onChange={(e) => setDegrees(e.target.value)} placeholder="MBBS (DMC), FCPS, MD" />
          <TextField label="Specialization" required value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Medicine and Cardiology" />
          <TextField label="BMDC registration number" required value={bmdcRegNo} onChange={(e) => setBmdcRegNo(e.target.value)} placeholder="A-45982" />
          <TextField label="Chamber room" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} placeholder="Chamber 402, 4th floor" />
        </div>

        <TextField label="Hospital or chamber" required value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="Dhaka Medical College and Hospital" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <TextField label="Official phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880 1819-XXXXXX" />
          <TextField label="Chamber email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@chamber.com" />
        </div>
      </form>
    </Modal>
  );
};

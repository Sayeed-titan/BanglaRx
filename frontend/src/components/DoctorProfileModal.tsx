import React, { useState, useEffect } from 'react';
import { X, Building2, Check, Stethoscope, Award } from 'lucide-react';
import type { Doctor } from '../types/index';

interface DoctorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onDoctorUpdated: (updated: Doctor) => void;
}

export const DoctorProfileModal: React.FC<DoctorProfileModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onDoctorUpdated,
}) => {
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
    if (doctor) {
      setName(doctor.name || '');
      setDegrees(doctor.degrees || '');
      setSpecialization(doctor.specialization || '');
      setBmdcRegNo(doctor.bmdc_reg_no || '');
      setHospitalName(doctor.hospital_name || '');
      setRoomNo(doctor.room_no || '');
      setPhone(doctor.phone || '');
      setEmail(doctor.email || '');
    }
  }, [doctor]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bmdcRegNo.trim()) {
      alert('Doctor name and BMDC registration number are mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: doctor?.id || 1,
        name,
        degrees,
        specialization,
        bmdc_reg_no: bmdcRegNo,
        hospital_name: hospitalName,
        room_no: roomNo,
        phone,
        email
      };

      const res = await fetch(`http://localhost:5000/api/doctors/${doctor?.id || 1}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updated = await res.json();
      onDoctorUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update doctor profile:', err);
      alert('Failed to save profile. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          maxWidth: '560px',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--slate-200)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--slate-50)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--teal-50)',
              color: 'var(--teal-700)',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              display: 'flex'
            }}>
              <Stethoscope size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                Physician Credentials & Chamber Setup
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                Official BMDC prescribing registration & hospital letterhead
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '22px', maxHeight: '75vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Physician Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Prof. Dr. M. A. Rahman"
                className="input-clinical"
                style={{ marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Medical Degrees *</label>
                <input
                  type="text"
                  required
                  value={degrees}
                  onChange={e => setDegrees(e.target.value)}
                  placeholder="MBBS (DMC), FCPS, MD"
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Specialization *</label>
                <input
                  type="text"
                  required
                  value={specialization}
                  onChange={e => setSpecialization(e.target.value)}
                  placeholder="Medicine & Cardiology"
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>BMDC Reg. Number *</label>
                <input
                  type="text"
                  required
                  value={bmdcRegNo}
                  onChange={e => setBmdcRegNo(e.target.value)}
                  placeholder="A-45982"
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Chamber Room No</label>
                <input
                  type="text"
                  value={roomNo}
                  onChange={e => setRoomNo(e.target.value)}
                  placeholder="Chamber 402, 4th Floor"
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Hospital / Chamber Affiliation *</label>
              <input
                type="text"
                required
                value={hospitalName}
                onChange={e => setHospitalName(e.target.value)}
                placeholder="Dhaka Medical College & Hospital"
                className="input-clinical"
                style={{ marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Official Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+880 1819-XXXXXX"
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Chamber Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@chamber.com"
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '18px', marginTop: '16px', borderTop: '1px solid var(--slate-100)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-clinical btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-clinical btn-primary-slate"
            >
              <Check size={16} />
              {isSubmitting ? 'Saving Profile...' : 'Save Physician Profile'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

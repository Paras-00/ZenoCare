import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FaCalendarPlus, FaSearch, FaClock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

function BookAppointment({ preSelectedPatient }) {
    const [doctors, setDoctors] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || null);

    const [formData, setFormData] = useState({
        patientId: preSelectedPatient?._id || '',
        doctorId: '',
        date: '',
        time: '',
        reason: '',
        consultationFee: 500
    });

    // Slots state
    const [slotsData, setSlotsData] = useState({
        loading: false,
        availableSlots: [],
        bookedSlots: [],
        message: '',
        isAvailable: true
    });

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const { data } = await api.get('/reception/doctors');
                if (data.success) {
                    setDoctors(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch doctors", error);
            }
        };
        fetchDoctors();
    }, []);

    useEffect(() => {
        if (preSelectedPatient) {
            setSelectedPatient(preSelectedPatient);
            setFormData(prev => ({ ...prev, patientId: preSelectedPatient._id }));
        }
    }, [preSelectedPatient]);

    // Live patient search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 1) {
                try {
                    const { data } = await api.get(`/reception/patients/search?query=${searchQuery}`);
                    if (data.success) {
                        setSearchResults(data.data);
                    }
                } catch (error) {
                    console.error("Search failed", error);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    // Live available slots search whenever doctor or date changes
    useEffect(() => {
        if (!formData.doctorId || !formData.date) {
            setSlotsData({
                loading: false,
                availableSlots: [],
                bookedSlots: [],
                message: '',
                isAvailable: true
            });
            return;
        }

        const fetchSlots = async () => {
            setSlotsData(prev => ({ ...prev, loading: true, message: '' }));
            try {
                const { data } = await api.get(`/reception/doctors/${formData.doctorId}/available-slots?date=${formData.date}`);
                if (data.success) {
                    setSlotsData({
                        loading: false,
                        availableSlots: data.availableSlots || [],
                        bookedSlots: data.bookedSlots || [],
                        message: data.message || '',
                        isAvailable: data.isAvailable
                    });
                }
            } catch (error) {
                console.error("Failed to fetch doctor slots", error);
                setSlotsData({
                    loading: false,
                    availableSlots: [],
                    bookedSlots: [],
                    message: error.response?.data?.message || 'Error checking slots',
                    isAvailable: false
                });
            }
        };

        fetchSlots();
    }, [formData.doctorId, formData.date]);

    const selectPatient = (patient) => {
        setSelectedPatient(patient);
        setFormData(prev => ({ ...prev, patientId: patient._id }));
        setSearchResults([]);
        setSearchQuery('');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'doctorId') {
            const doc = doctors.find(d => d._id === value);
            setFormData(prev => ({
                ...prev,
                doctorId: value,
                time: '',
                consultationFee: doc?.consultationFee || 500
            }));
        } else if (name === 'date') {
            setFormData(prev => ({ ...prev, date: value, time: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSelectSlot = (slot) => {
        setFormData(prev => ({ ...prev, time: slot }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedPatient) {
            alert('Please select a patient first');
            return;
        }

        if (!formData.doctorId) {
            alert('Please select a doctor');
            return;
        }

        if (!formData.time) {
            alert('Please select an available appointment time slot');
            return;
        }

        try {
            const { data } = await api.post('/reception/appointments', formData);
            if (data.success) {
                alert(`Appointment Booked Successfully for ${data.data.appointmentTime} on ${formData.date}!`);
                setFormData(prev => ({ ...prev, date: '', time: '', reason: '' }));
                setSlotsData({ loading: false, availableSlots: [], bookedSlots: [], message: '', isAvailable: true });
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error booking appointment: conflict detected');
        }
    };

    return (
        <div className="book-appointment">
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
                <h3><FaCalendarPlus /> Book Appointment & Verified Slot Finder</h3>
            </div>

            <div className="appointment-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '2rem' }}>
                {/* Left Column: Patient Selection */}
                <div className="patient-selection-column">
                    <h4 style={{ marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>1. Select Patient</h4>

                    {!selectedPatient ? (
                        <div className="search-box">
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="Search by Name, Phone, or Patient ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                />
                            </div>

                            {searchResults.length > 0 && (
                                <ul style={{ listStyle: 'none', padding: 0, border: '1px solid #eee', borderRadius: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                                    {searchResults.map(p => (
                                        <li
                                            key={p._id}
                                            onClick={() => selectPatient(p)}
                                            style={{ padding: '0.9rem', borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{p.firstName} {p.lastName}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Phone: {p.phone}  |  Blood: {p.bloodGroup || 'N/A'}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {p.patientId}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {searchResults.length === 0 && searchQuery && (
                                <p style={{ color: '#64748b', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>No synthetic patients matching query.</p>
                            )}
                        </div>
                    ) : (
                        <div className="selected-patient-card" style={{ padding: '1.2rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                <h4 style={{ margin: 0, color: '#1d4ed8' }}><FaCheckCircle /> Selected Patient</h4>
                                <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                                    Change
                                </button>
                            </div>
                            <p style={{ margin: '0.4rem 0' }}><strong>Name:</strong> {selectedPatient.firstName} {selectedPatient.lastName}</p>
                            <p style={{ margin: '0.4rem 0' }}><strong>Patient ID:</strong> {selectedPatient.patientId}</p>
                            <p style={{ margin: '0.4rem 0' }}><strong>Phone:</strong> {selectedPatient.phone}</p>
                            <p style={{ margin: '0.4rem 0' }}><strong>Blood Group:</strong> {selectedPatient.bloodGroup || 'Not specified'}</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Appointment Details & Slot Finder */}
                <div className="appointment-details-column">
                    <h4 style={{ marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>2. Doctor Schedule & Available Slot Selection</h4>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Select Doctor</label>
                            <select name="doctorId" value={formData.doctorId} onChange={handleChange} required style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}>
                                <option value="">-- Choose Doctor --</option>
                                {doctors.map(doc => (
                                    <option key={doc._id} value={doc._id}>
                                        Dr. {doc.firstName} {doc.lastName} — {doc.specialization} (Fee: ₹{doc.consultationFee || 500})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Appointment Date</label>
                            <input
                                type="date"
                                name="date"
                                min={new Date().toISOString().slice(0, 10)}
                                value={formData.date}
                                onChange={handleChange}
                                required
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
                            />
                        </div>

                        {/* Live Slot Engine */}
                        {formData.doctorId && formData.date && (
                            <div className="slots-section" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <FaClock style={{ color: '#2563eb' }} /> Available Doctor Slots
                                    </span>
                                    {slotsData.loading && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Checking schedule...</span>}
                                </div>

                                {slotsData.message && !slotsData.isAvailable && (
                                    <div style={{ color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                                        <FaExclamationTriangle /> {slotsData.message}
                                    </div>
                                )}

                                {slotsData.availableSlots.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {slotsData.availableSlots.map(slot => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => handleSelectSlot(slot)}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    border: formData.time === slot ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                                    background: formData.time === slot ? '#2563eb' : 'white',
                                                    color: formData.time === slot ? 'white' : '#334155',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    !slotsData.loading && (
                                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                                            No open slots available for this doctor on this date.
                                        </p>
                                    )
                                )}

                                {slotsData.bookedSlots.length > 0 && (
                                    <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.75rem', color: '#94a3b8' }}>
                                        <strong>Already Booked / Conflict Protected:</strong> {slotsData.bookedSlots.join(', ')}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Selected Time Slot</label>
                            <input
                                type="text"
                                name="time"
                                placeholder="Choose from available slots above"
                                value={formData.time}
                                readOnly
                                required
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd', background: '#f8fafc', fontWeight: 'bold', color: formData.time ? '#1e40af' : '#64748b' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Reason for Visit</label>
                            <textarea
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                required
                                rows="3"
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                placeholder="e.g. Chest pain, Follow-up consultation, Seasonal checkup"
                            ></textarea>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Consultation Fee (₹)</label>
                            <input
                                type="number"
                                name="consultationFee"
                                min="0"
                                value={formData.consultationFee}
                                onChange={handleChange}
                                required
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!selectedPatient || !formData.doctorId || !formData.time}
                            style={{
                                padding: '0.9rem',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: (!selectedPatient || !formData.doctorId || !formData.time) ? 'not-allowed' : 'pointer',
                                opacity: (!selectedPatient || !formData.doctorId || !formData.time) ? 0.6 : 1,
                                background: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px'
                            }}
                        >
                            Confirm & Reserve Slot
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default BookAppointment;

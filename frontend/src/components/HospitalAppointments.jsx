import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FaCalendarCheck, FaUser, FaClock, FaUserMd, FaExchangeAlt, FaBan, FaTimes } from 'react-icons/fa';

function HospitalAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');

    // Reschedule Modal State
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [rescheduleReason, setRescheduleReason] = useState('');
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [rescheduling, setRescheduling] = useState(false);
    const [modalError, setModalError] = useState('');

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const { data } = await api.get('/hospital/appointments');
            if (data.success) {
                setAppointments(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch appointments", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenReschedule = (apt) => {
        setRescheduleTarget(apt);
        const currDate = apt.appointmentDate ? new Date(apt.appointmentDate).toISOString().split('T')[0] : '';
        setRescheduleDate(currDate);
        setRescheduleTime('');
        setRescheduleReason('');
        setAvailableSlots([]);
        setModalError('');
        if (currDate && apt.doctorId?._id) {
            fetchSlots(apt.doctorId._id, currDate);
        }
    };

    const fetchSlots = async (doctorId, date) => {
        setLoadingSlots(true);
        setModalError('');
        try {
            const { data } = await api.get(`/reception/doctors/${doctorId}/available-slots?date=${date}`);
            if (data.success) {
                setAvailableSlots(data.availableSlots || []);
            }
        } catch (err) {
            setModalError('Could not load slots for selected date.');
            setAvailableSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setRescheduleDate(newDate);
        setRescheduleTime('');
        if (newDate && rescheduleTarget?.doctorId?._id) {
            fetchSlots(rescheduleTarget.doctorId._id, newDate);
        }
    };

    const handleConfirmReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleDate || !rescheduleTime) {
            setModalError('Please pick both date and an available time slot.');
            return;
        }

        setRescheduling(true);
        setModalError('');
        try {
            const { data } = await api.put(`/reception/appointments/${rescheduleTarget._id}/reschedule`, {
                newDate: rescheduleDate,
                newTime: rescheduleTime,
                reason: rescheduleReason || 'Rescheduled via Reception'
            });

            if (data.success) {
                alert('Appointment rescheduled successfully!');
                setRescheduleTarget(null);
                fetchAppointments();
            }
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to reschedule appointment.');
        } finally {
            setRescheduling(false);
        }
    };

    const handleCancelAppointment = async (apt) => {
        const reason = window.prompt(`Cancel appointment for ${apt.patientId?.firstName} ${apt.patientId?.lastName}?\nPlease enter reason for cancellation:`, 'Patient requested cancellation');
        if (reason === null) return; // User pressed cancel on prompt

        try {
            const { data } = await api.put(`/reception/appointments/${apt._id}/cancel`, {
                reason: reason.trim() || 'Cancelled via Reception'
            });

            if (data.success) {
                alert('Appointment cancelled successfully.');
                fetchAppointments();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to cancel appointment.');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Confirmed': return <span className="status-badge active" style={{ background: '#e3f2fd', color: '#1976d2', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>Confirmed</span>;
            case 'Completed': return <span className="status-badge bg-green" style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>Completed</span>;
            case 'Cancelled': return <span className="status-badge bg-red" style={{ background: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>Cancelled</span>;
            default: return <span className="status-badge pending" style={{ background: '#fff3e0', color: '#ef6c00', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>Scheduled</span>;
        }
    };

    const filteredAppointments = appointments.filter(apt => {
        if (filterStatus === 'All') return true;
        return apt.status === filterStatus;
    });

    return (
        <div className="hospital-appointments">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#1f2937' }}>Hospital Appointments Management</h2>
                    <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>Real-time appointment schedule, slot reallocation & conflict-safe booking</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['All', 'Scheduled', 'Completed', 'Cancelled'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilterStatus(tab)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: '1px solid',
                                borderColor: filterStatus === tab ? '#2563eb' : '#d1d5db',
                                background: filterStatus === tab ? '#2563eb' : '#ffffff',
                                color: filterStatus === tab ? '#ffffff' : '#4b5563',
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? <p>Loading appointments...</p> : (
                <div className="appointments-list">
                    {filteredAppointments.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                            <p style={{ color: '#6b7280' }}>No {filterStatus !== 'All' ? filterStatus.toLowerCase() : ''} appointments found.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <thead style={{ background: '#f8f9fa' }}>
                                    <tr>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Date & Time</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Patient</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Doctor</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Reason</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((apt) => (
                                        <tr key={apt._id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: '600', color: '#111827' }}>{new Date(apt.appointmentDate).toLocaleDateString()}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <FaClock style={{ fontSize: '0.75rem' }} /> {apt.appointmentTime}
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: '500' }}>{apt.patientId?.firstName} {apt.patientId?.lastName}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{apt.patientId?.phone || apt.patientId?.email}</div>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FaUserMd style={{ color: '#0284c7' }} />
                                                    <span style={{ fontWeight: '500' }}>Dr. {apt.doctorId?.firstName} {apt.doctorId?.lastName}</span>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{apt.doctorId?.specialization}</div>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                {getStatusBadge(apt.status)}
                                            </td>
                                            <td style={{ padding: '14px 16px', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {apt.reason || '-'}
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                {apt.status === 'Scheduled' || apt.status === 'Confirmed' ? (
                                                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => handleOpenReschedule(apt)}
                                                            title="Reschedule Appointment"
                                                            style={{
                                                                padding: '6px 10px',
                                                                background: '#eff6ff',
                                                                color: '#1d4ed8',
                                                                border: '1px solid #bfdbfe',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '500',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            <FaExchangeAlt /> Reschedule
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelAppointment(apt)}
                                                            title="Cancel Appointment"
                                                            style={{
                                                                padding: '6px 10px',
                                                                background: '#fef2f2',
                                                                color: '#b91c1c',
                                                                border: '1px solid #fecaca',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '500',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            <FaBan /> Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Reschedule Modal */}
            {rescheduleTarget && (
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '520px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '1.75rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaExchangeAlt style={{ color: '#2563eb' }} /> Reschedule Appointment
                            </h3>
                            <button
                                onClick={() => setRescheduleTarget(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#6b7280' }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {modalError && (
                            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #f87171', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                {modalError}
                            </div>
                        )}

                        <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                            <div><strong>Patient:</strong> {rescheduleTarget.patientId?.firstName} {rescheduleTarget.patientId?.lastName}</div>
                            <div><strong>Doctor:</strong> Dr. {rescheduleTarget.doctorId?.firstName} {rescheduleTarget.doctorId?.lastName} ({rescheduleTarget.doctorId?.specialization})</div>
                            <div><strong>Current Slot:</strong> {new Date(rescheduleTarget.appointmentDate).toLocaleDateString()} at {rescheduleTarget.appointmentTime}</div>
                        </div>

                        <form onSubmit={handleConfirmReschedule}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}>
                                    Select New Date:
                                </label>
                                <input
                                    type="date"
                                    value={rescheduleDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={handleDateChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}>
                                    Select New Time Slot:
                                </label>
                                {loadingSlots ? (
                                    <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Checking doctor slot availability...</p>
                                ) : availableSlots.length === 0 ? (
                                    <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>No slots available on this date. Doctor may not be scheduled or slots are booked.</p>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
                                        gap: '0.5rem',
                                        maxHeight: '140px',
                                        overflowY: 'auto',
                                        padding: '0.5rem',
                                        background: '#f9fafb',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px'
                                    }}>
                                        {availableSlots.map(slot => (
                                            <button
                                                type="button"
                                                key={slot}
                                                onClick={() => setRescheduleTime(slot)}
                                                style={{
                                                    padding: '0.4rem 0.2rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid',
                                                    borderColor: rescheduleTime === slot ? '#2563eb' : '#cbd5e1',
                                                    background: rescheduleTime === slot ? '#2563eb' : '#ffffff',
                                                    color: rescheduleTime === slot ? '#ffffff' : '#1e293b',
                                                    fontSize: '0.85rem',
                                                    fontWeight: rescheduleTime === slot ? '600' : '400',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}>
                                    Reason for Rescheduling:
                                </label>
                                <input
                                    type="text"
                                    value={rescheduleReason}
                                    onChange={(e) => setRescheduleReason(e.target.value)}
                                    placeholder="e.g., Doctor delayed, Patient requested morning slot"
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setRescheduleTarget(null)}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: '#f3f4f6',
                                        color: '#4b5563',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={rescheduling || !rescheduleTime}
                                    style={{
                                        padding: '0.6rem 1.25rem',
                                        background: rescheduleTime ? '#2563eb' : '#93c5fd',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: rescheduleTime ? 'pointer' : 'not-allowed',
                                        fontWeight: '500'
                                    }}
                                >
                                    {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HospitalAppointments;

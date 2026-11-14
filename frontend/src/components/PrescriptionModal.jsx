import { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaTimes, FaSave, FaHeartbeat, FaVial, FaNotesMedical, FaPills } from 'react-icons/fa';
import api from '../utils/api';

const PrescriptionModal = ({ appointment, onClose, onSuccess }) => {
    const [chiefComplaint, setChiefComplaint] = useState(appointment?.reason || '');
    const [visitType, setVisitType] = useState('Consultation');

    // Vitals
    const [vitals, setVitals] = useState({
        bloodPressure: '120/80 mmHg',
        heartRate: 72,
        temperature: '98.6 F',
        spO2: 98,
        weight: 70
    });

    // Clinician Notes (Non-automated clinician clinical evaluation)
    const [clinicianNotes, setClinicianNotes] = useState({
        subjective: '',
        objective: '',
        assessment: appointment?.diagnosis || '',
        plan: appointment?.notes || ''
    });

    // Medicines
    const [medicines, setMedicines] = useState([
        { medicine: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After meals' }
    ]);

    // Diagnostic Reports Metadata
    const [diagnostics, setDiagnostics] = useState([
        { testName: '', category: 'Lab Diagnostics', status: 'Ordered', resultSummary: '' }
    ]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch existing visit record if available
        const fetchVisit = async () => {
            if (!appointment?._id) return;
            try {
                const { data } = await api.get(`/doctor/appointments/${appointment._id}/visit`);
                if (data.success && data.data) {
                    const v = data.data;
                    if (v.chiefComplaint) setChiefComplaint(v.chiefComplaint);
                    if (v.visitType) setVisitType(v.visitType);
                    if (v.vitals) setVitals(prev => ({ ...prev, ...v.vitals }));
                    if (v.clinicianNotes) setClinicianNotes(prev => ({ ...prev, ...v.clinicianNotes }));
                    if (v.prescriptions?.length > 0) setMedicines(v.prescriptions);
                    if (v.diagnosticReports?.length > 0) setDiagnostics(v.diagnosticReports);
                }
            } catch (e) {
                // No prior visit record, use defaults
            }
        };

        if (appointment?.prescription?.length > 0) {
            setMedicines(appointment.prescription);
        }
        fetchVisit();
    }, [appointment]);

    const handleVitalChange = (e) => {
        setVitals({ ...vitals, [e.target.name]: e.target.value });
    };

    const handleNotesChange = (e) => {
        setClinicianNotes({ ...clinicianNotes, [e.target.name]: e.target.value });
    };

    // Medicines
    const handleMedicineChange = (index, field, value) => {
        const updated = [...medicines];
        updated[index][field] = value;
        setMedicines(updated);
    };

    const addMedicineRow = () => {
        setMedicines([...medicines, { medicine: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After meals' }]);
    };

    const removeMedicineRow = (index) => {
        if (medicines.length > 1) {
            setMedicines(medicines.filter((_, i) => i !== index));
        }
    };

    // Diagnostics
    const handleDiagnosticChange = (index, field, value) => {
        const updated = [...diagnostics];
        updated[index][field] = value;
        setDiagnostics(updated);
    };

    const addDiagnosticRow = () => {
        setDiagnostics([...diagnostics, { testName: '', category: 'Lab Diagnostics', status: 'Ordered', resultSummary: '' }]);
    };

    const removeDiagnosticRow = (index) => {
        if (diagnostics.length > 1) {
            setDiagnostics(diagnostics.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const validMedicines = medicines.filter(m => m.medicine.trim() !== '');
        const validDiagnostics = diagnostics.filter(d => d.testName.trim() !== '');

        if (!chiefComplaint.trim() && !clinicianNotes.assessment.trim()) {
            setError('Please enter chief complaint or clinical assessment.');
            setLoading(false);
            return;
        }

        try {
            const payload = {
                visitType,
                chiefComplaint: chiefComplaint.trim() || 'General Consultation',
                vitals,
                clinicianNotes,
                prescriptions: validMedicines,
                diagnosticReports: validDiagnostics,
                markCompleted: true
            };

            const response = await api.post(`/doctor/appointments/${appointment._id}/visit`, payload);

            if (response.data.success) {
                alert('Clinical Visit Record, Vitals, Prescriptions, and Diagnostics Saved Successfully!');
                if (onSuccess) onSuccess(response.data.data);
                onClose();
            }
        } catch (err) {
            console.error("Error saving clinical visit record:", err);
            setError(err.response?.data?.message || 'Failed to save visit record');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '850px', width: '92%', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.8rem' }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaNotesMedical /> Clinical Visit Encounter & Prescription
                        </h2>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            Patient: <strong>{appointment?.patientId?.firstName} {appointment?.patientId?.lastName}</strong> (Blood: {appointment?.patientId?.bloodGroup || 'N/A'})
                        </span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                        <FaTimes />
                    </button>
                </div>

                {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    {/* Encounter Metadata */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Chief Complaint</label>
                            <input
                                type="text"
                                value={chiefComplaint}
                                onChange={(e) => setChiefComplaint(e.target.value)}
                                placeholder="e.g. Chest tightness, Fever with chills, Knee pain"
                                required
                                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Visit Type</label>
                            <select
                                value={visitType}
                                onChange={(e) => setVisitType(e.target.value)}
                                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            >
                                <option value="Consultation">OPD Consultation</option>
                                <option value="Follow-up">Follow-up</option>
                                <option value="Emergency">Emergency</option>
                                <option value="Routine Checkup">Routine Checkup</option>
                            </select>
                        </div>
                    </div>

                    {/* Vitals Section */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FaHeartbeat style={{ color: '#ef4444' }} /> Patient Vitals
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Blood Pressure</label>
                                <input
                                    type="text"
                                    name="bloodPressure"
                                    value={vitals.bloodPressure}
                                    onChange={handleVitalChange}
                                    placeholder="120/80"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Pulse (bpm)</label>
                                <input
                                    type="number"
                                    name="heartRate"
                                    value={vitals.heartRate}
                                    onChange={handleVitalChange}
                                    placeholder="72"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Temp (°F)</label>
                                <input
                                    type="text"
                                    name="temperature"
                                    value={vitals.temperature}
                                    onChange={handleVitalChange}
                                    placeholder="98.6 F"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>SpO2 (%)</label>
                                <input
                                    type="number"
                                    name="spO2"
                                    value={vitals.spO2}
                                    onChange={handleVitalChange}
                                    placeholder="98"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Weight (kg)</label>
                                <input
                                    type="number"
                                    name="weight"
                                    value={vitals.weight}
                                    onChange={handleVitalChange}
                                    placeholder="70"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Clinician Notes Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>
                                Clinician Clinical Assessment (Non-Automated)
                            </label>
                            <textarea
                                name="assessment"
                                value={clinicianNotes.assessment}
                                onChange={handleNotesChange}
                                placeholder="Clinician-entered diagnosis and clinical impression..."
                                rows="3"
                                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            ></textarea>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>
                                Clinical Plan & Advice
                            </label>
                            <textarea
                                name="plan"
                                value={clinicianNotes.plan}
                                onChange={handleNotesChange}
                                placeholder="Management plan, lifestyle advice, diet..."
                                rows="3"
                                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            ></textarea>
                        </div>
                    </div>

                    {/* Prescriptions Table */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FaPills style={{ color: '#2563eb' }} /> Prescriptions
                            </h4>
                            <button type="button" onClick={addMedicineRow} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                                + Add Medicine
                            </button>
                        </div>

                        {medicines.map((med, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="Medicine Name"
                                    value={med.medicine}
                                    onChange={(e) => handleMedicineChange(idx, 'medicine', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Dosage (500mg)"
                                    value={med.dosage}
                                    onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Freq (1-0-1)"
                                    value={med.frequency}
                                    onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Duration"
                                    value={med.duration}
                                    onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Instructions (After food)"
                                    value={med.instructions}
                                    onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                {medicines.length > 1 && (
                                    <button type="button" onClick={() => removeMedicineRow(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <FaTrash />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Diagnostic Reports Metadata */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FaVial style={{ color: '#7c3aed' }} /> Diagnostic Reports & Lab Orders
                            </h4>
                            <button type="button" onClick={addDiagnosticRow} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                                + Add Test Order
                            </button>
                        </div>

                        {diagnostics.map((diag, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="Test Name (e.g. ECG, CBC, Lipid)"
                                    value={diag.testName}
                                    onChange={(e) => handleDiagnosticChange(idx, 'testName', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Category"
                                    value={diag.category}
                                    onChange={(e) => handleDiagnosticChange(idx, 'category', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                <select
                                    value={diag.status}
                                    onChange={(e) => handleDiagnosticChange(idx, 'status', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                >
                                    <option value="Ordered">Ordered</option>
                                    <option value="Sample Collected">Sample Collected</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Result Summary / Clinical notes"
                                    value={diag.resultSummary}
                                    onChange={(e) => handleDiagnosticChange(idx, 'resultSummary', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                />
                                {diagnostics.length > 1 && (
                                    <button type="button" onClick={() => removeDiagnosticRow(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <FaTrash />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose} style={{ padding: '0.8rem 1.5rem', border: '1px solid #cbd5e1', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} style={{ padding: '0.8rem 1.5rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {loading ? 'Saving...' : <><FaSave /> Finalize & Complete Visit</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PrescriptionModal;

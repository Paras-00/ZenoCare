import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FaChartBar, FaFileInvoiceDollar, FaCalendarCheck, FaUsers, FaSync } from 'react-icons/fa';

function HospitalReports() {
    const [reports, setReports] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/hospital/reports/summary');
            if (data.success) {
                setReports(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch reports summary:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Generating analytics reports...</div>;
    }

    if (!reports) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>Unable to load reports.</div>;
    }

    const { appointments, billing, demographics } = reports;

    return (
        <div className="hospital-reports" style={{ padding: '0.5rem' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a' }}>
                        <FaChartBar style={{ color: '#2563eb' }} /> Operations & Financial Summary Reports
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                        Consolidated analytics covering appointments, clinical encounter volumes, and reconciled billing metrics
                    </p>
                </div>
                <button
                    onClick={fetchReports}
                    style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                    }}
                >
                    <FaSync /> Refresh
                </button>
            </div>

            {/* Top KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Patients</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{demographics.totalPatients}</div>
                </div>
                <div style={{ background: '#eff6ff', padding: '1.2rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '0.75rem', color: '#1d4ed8', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Invoiced</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1e40af', marginTop: '4px' }}>₹{billing.totalInvoiced.toLocaleString()}</div>
                </div>
                <div style={{ background: '#f0fdf4', padding: '1.2rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#15803d', textTransform: 'uppercase', fontWeight: 'bold' }}>Collected Revenue</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#166534', marginTop: '4px' }}>₹{billing.totalCollected.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fffbeb', padding: '1.2rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', textTransform: 'uppercase', fontWeight: 'bold' }}>Collection Rate</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#92400e', marginTop: '4px' }}>{billing.collectionRate}%</div>
                </div>
            </div>

            {/* Detailed Analytics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Appointment Status Breakdown */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaCalendarCheck style={{ color: '#2563eb' }} /> Appointment Status Distribution
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Object.entries(appointments.byStatus || {}).map(([status, count]) => (
                            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontWeight: '500', color: '#334155' }}>{status}</span>
                                <span style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold', color: '#0f172a' }}>{count}</span>
                            </div>
                        ))}
                        {Object.keys(appointments.byStatus || {}).length === 0 && (
                            <p style={{ color: '#94a3b8', margin: 0 }}>No appointments on record.</p>
                        )}
                    </div>
                </div>

                {/* Billing & Settlement Breakdown */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaFileInvoiceDollar style={{ color: '#16a34a' }} /> Payment Gateway Settlements Breakdown
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Object.entries(billing.paymentMethodsBreakdown || {}).map(([method, amount]) => (
                            <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontWeight: '500', color: '#334155' }}>{method}</span>
                                <span style={{ color: '#15803d', fontWeight: 'bold' }}>₹{amount.toLocaleString()}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderTop: '2px solid #e2e8f0', fontWeight: 'bold', marginTop: '0.5rem' }}>
                            <span>Pending Receivables</span>
                            <span style={{ color: '#b45309' }}>₹{billing.pendingAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Doctor Performance Table */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaUsers style={{ color: '#7c3aed' }} /> Clinician Caseload Summary
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <th style={{ padding: '10px 12px' }}>Clinician</th>
                            <th style={{ padding: '10px 12px' }}>Specialization</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Consultations</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(appointments.byDoctor || []).map((doc, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#1e3a8a' }}>{doc.doctorName || 'Dr. Assigned'}</td>
                                <td style={{ padding: '10px 12px', color: '#64748b' }}>{doc.specialization || 'Clinical'}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>{doc.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default HospitalReports;

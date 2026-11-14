import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FaShieldAlt, FaSync, FaFilter, FaUserCheck } from 'react-icons/fa';

function AuditTrail() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    useEffect(() => {
        fetchLogs();
    }, [actionFilter, roleFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let url = '/hospital/audit-logs?limit=100';
            if (actionFilter) url += `&action=${actionFilter}`;
            if (roleFilter) url += `&userRole=${roleFilter}`;

            const { data } = await api.get(url);
            if (data.success) {
                setLogs(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionBadge = (action) => {
        let bg = '#f1f5f9';
        let color = '#475569';

        switch (action) {
            case 'PATIENT_CREATE':
            case 'APPOINTMENT_BOOK':
                bg = '#dbeafe'; color = '#1d4ed8'; break;
            case 'PATIENT_VIEW':
                bg = '#e0e7ff'; color = '#4338ca'; break;
            case 'PATIENT_UPDATE':
            case 'APPOINTMENT_RESCHEDULE':
                bg = '#fef3c7'; color = '#b45309'; break;
            case 'PATIENT_DELETE':
            case 'APPOINTMENT_CANCEL':
                bg = '#fee2e2'; color = '#b91c1c'; break;
            case 'VISIT_RECORD_CREATE':
            case 'VISIT_RECORD_UPDATE':
                bg = '#ede9fe'; color = '#6d28d9'; break;
            case 'PAYMENT_PROCESSED':
                bg = '#dcfce7'; color = '#15803d'; break;
            default:
                break;
        }

        return (
            <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                background: bg,
                color
            }}>
                {action}
            </span>
        );
    };

    return (
        <div className="audit-trail" style={{ padding: '0.5rem' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a' }}>
                        <FaShieldAlt style={{ color: '#2563eb' }} /> Security & Clinical Audit Trail
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                        Immutable compliance record of all reads and modifications to sensitive patient, appointment, and clinical records
                    </p>
                </div>
                <button
                    onClick={fetchLogs}
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
                    <FaSync /> Refresh Trail
                </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaFilter /> Filter Logs:
                </span>
                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    style={{ padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                    <option value="">All Actions</option>
                    <option value="PATIENT_VIEW">PATIENT_VIEW (Sensitive Record Read)</option>
                    <option value="PATIENT_CREATE">PATIENT_CREATE</option>
                    <option value="PATIENT_UPDATE">PATIENT_UPDATE</option>
                    <option value="PATIENT_DELETE">PATIENT_DELETE</option>
                    <option value="APPOINTMENT_BOOK">APPOINTMENT_BOOK</option>
                    <option value="APPOINTMENT_RESCHEDULE">APPOINTMENT_RESCHEDULE</option>
                    <option value="APPOINTMENT_CANCEL">APPOINTMENT_CANCEL</option>
                    <option value="VISIT_RECORD_CREATE">VISIT_RECORD_CREATE (Clinical Record)</option>
                    <option value="PAYMENT_PROCESSED">PAYMENT_PROCESSED (Sandbox Settlement)</option>
                </select>

                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{ padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                    <option value="">All Roles</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="doctor">Doctor</option>
                    <option value="hospital_admin">Hospital Admin</option>
                    <option value="billing">Billing</option>
                </select>

                <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b' }}>
                    Total Events: <strong>{logs.length}</strong>
                </span>
            </div>

            {/* Audit Log Table */}
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <th style={{ padding: '12px 14px' }}>Timestamp</th>
                            <th style={{ padding: '12px 14px' }}>User</th>
                            <th style={{ padding: '12px 14px' }}>Role</th>
                            <th style={{ padding: '12px 14px' }}>Action</th>
                            <th style={{ padding: '12px 14px' }}>Resource</th>
                            <th style={{ padding: '12px 14px' }}>Audit Details</th>
                            <th style={{ padding: '12px 14px' }}>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 'bold', color: '#0f172a' }}>
                                    {log.userName}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <span style={{ textTransform: 'capitalize', color: '#475569' }}>{log.userRole}</span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    {getActionBadge(log.action)}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#334155' }}>
                                    <strong>{log.resourceType}</strong>
                                    {log.resourceId && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {String(log.resourceId).slice(-6)}</div>}
                                </td>
                                <td style={{ padding: '10px 14px', maxWidth: '300px', wordBreak: 'break-word', color: '#475569' }}>
                                    {log.details ? JSON.stringify(log.details).replace(/"/g, '').replace(/^{|}$/g, '') : '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    {log.ipAddress || '127.0.0.1'}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    No audit entries recorded for selected filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AuditTrail;

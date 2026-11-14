import { useState, useEffect } from 'react';
import api from '../utils/api';
import {
    FaFileInvoiceDollar, FaPlus, FaTrash, FaTimes,
    FaFilePdf, FaCreditCard, FaCheckCircle, FaMoneyCheckAlt
} from 'react-icons/fa';

function BillingManagement() {
    const [invoices, setInvoices] = useState([]);
    const [billableAppointments, setBillableAppointments] = useState([]);
    const [summary, setSummary] = useState({ totalInvoices: 0, totalRevenue: 0, pendingRevenue: 0 });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Sandbox Payment Modal State
    const [paymentModal, setPaymentModal] = useState({
        isOpen: false,
        invoice: null,
        method: 'Card',
        processing: false
    });

    // Form State
    const initialFormState = {
        patientName: '',
        patientId: '',
        appointmentId: '',
        status: 'Pending',
        items: [{ description: '', quantity: 1, unitPrice: '', cost: '' }],
        tax: 0,
        discount: 0,
        date: new Date().toISOString().split('T')[0]
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchInvoices(), fetchBillableAppointments()]);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoices = async () => {
        try {
            const { data } = await api.get('/hospital/invoices');
            if (data.success) {
                setInvoices(data.data);
                if (data.summary) setSummary(data.summary);
            }
        } catch (error) {
            console.error("Failed to fetch invoices", error);
        }
    };

    const fetchBillableAppointments = async () => {
        try {
            const { data } = await api.get('/hospital/billable-appointments');
            if (data.success) {
                setBillableAppointments(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch billable appointments", error);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        const qty = parseFloat(newItems[index].quantity) || 1;
        const price = parseFloat(newItems[index].unitPrice) || 0;
        newItems[index].cost = qty * price;
        setFormData({ ...formData, items: newItems });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', quantity: 1, unitPrice: '', cost: '' }]
        });
    };

    const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this invoice? The linked appointment will be unbilled.')) return;
        try {
            const { data } = await api.delete(`/hospital/invoices/${id}`);
            if (data.success) {
                alert('Invoice deleted.');
                fetchData();
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error deleting invoice');
        }
    };

    const openAddModal = (appointment = null) => {
        if (appointment) {
            const consultationCost = appointment.consultationFee || 500;
            const items = [
                { description: 'Physician Consultation Fee', quantity: 1, unitPrice: consultationCost, cost: consultationCost }
            ];

            if (appointment.prescription && appointment.prescription.length > 0) {
                appointment.prescription.forEach(p => {
                    items.push({
                        description: `Prescription: ${p.medicine} (${p.dosage})`,
                        quantity: 1,
                        unitPrice: 150,
                        cost: 150
                    });
                });
            }

            if (appointment.tests && appointment.tests.length > 0) {
                appointment.tests.forEach(t => {
                    items.push({
                        description: `Diagnostics: ${t.testName || t}`,
                        quantity: 1,
                        unitPrice: 400,
                        cost: 400
                    });
                });
            }

            setFormData({
                patientName: `${appointment.patientId?.firstName} ${appointment.patientId?.lastName || ''}`.trim(),
                patientId: appointment.patientId?._id,
                appointmentId: appointment._id,
                status: 'Pending',
                items,
                tax: 0,
                discount: 0,
                date: new Date().toISOString().split('T')[0]
            });
        } else {
            setFormData(initialFormState);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/hospital/invoices', formData);
            if (response.data.success) {
                alert(`Invoice ${response.data.data.invoiceNumber || ''} created with reconciled total ₹${response.data.data.totalAmount}`);
                setShowModal(false);
                fetchData();
                setFormData(initialFormState);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error creating invoice');
        }
    };

    // Open Sandbox Payment Modal
    const openSandboxPayment = (invoice) => {
        setPaymentModal({
            isOpen: true,
            invoice,
            method: 'Card',
            processing: false
        });
    };

    // Execute Sandbox Payment
    const handleSandboxPaymentSubmit = async (e) => {
        e.preventDefault();
        const { invoice, method } = paymentModal;
        if (!invoice) return;

        setPaymentModal(prev => ({ ...prev, processing: true }));

        try {
            const { data } = await api.post(`/hospital/invoices/${invoice._id}/sandbox-pay`, {
                paymentMethod: method,
                amountPaid: invoice.totalAmount
            });

            if (data.success) {
                alert(`✓ Sandbox Payment Verified!\nTransaction ID: ${data.data.paymentDetails?.transactionId}\nStatus: Settled (₹${data.data.totalAmount})`);
                setPaymentModal({ isOpen: false, invoice: null, method: 'Card', processing: false });
                fetchData();
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Sandbox Payment Failed');
            setPaymentModal(prev => ({ ...prev, processing: false }));
        }
    };

    // Download PDF Invoice
    const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
        try {
            const response = await api.get(`/hospital/invoices/${invoiceId}/pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Invoice-${invoiceNumber || invoiceId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert('Error generating PDF invoice');
        }
    };

    const calculateFormSubtotal = () => {
        return formData.items.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
    };

    const calculateFormTotal = () => {
        const sub = calculateFormSubtotal();
        const tax = parseFloat(formData.tax) || 0;
        const discount = parseFloat(formData.discount) || 0;
        return Math.max(0, sub + tax - discount);
    };

    return (
        <div className="billing-management" style={{ padding: '0.5rem' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaFileInvoiceDollar style={{ color: '#2563eb' }} /> Billing, Invoices & Sandbox Settlements
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                        Reconciled itemized invoicing with simulated payment gateway and downloadable PDF receipts
                    </p>
                </div>
                <button
                    onClick={() => openAddModal()}
                    style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: '600'
                    }}
                >
                    <FaPlus /> Create Itemized Invoice
                </button>
            </div>

            {/* Financial Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Invoices</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{summary.totalInvoices || invoices.length}</div>
                </div>
                <div style={{ background: '#f0fdf4', padding: '1.2rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#166534', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Collected (Sandbox)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>₹{summary.totalRevenue.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fffbeb', padding: '1.2rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.8rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 'bold' }}>Pending Invoices</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#b45309', marginTop: '4px' }}>₹{summary.pendingRevenue.toLocaleString()}</div>
                </div>
            </div>

            {/* Unbilled Completed Consultations */}
            {billableAppointments.length > 0 && (
                <div style={{ marginBottom: '2rem', background: '#eff6ff', padding: '1.2rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <h4 style={{ margin: '0 0 0.8rem 0', color: '#1d4ed8' }}>
                        Completed Consultations Awaiting Billing ({billableAppointments.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {billableAppointments.map(apt => (
                            <div key={apt._id} style={{ minWidth: '240px', background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{apt.patientId?.firstName} {apt.patientId?.lastName}</div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Dr. {apt.doctorId?.firstName} {apt.doctorId?.lastName}</div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(apt.appointmentDate).toLocaleDateString()}</div>
                                <button
                                    onClick={() => openAddModal(apt)}
                                    style={{
                                        marginTop: '0.6rem',
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    Generate Invoice
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invoices List Table */}
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <th style={{ padding: '12px 16px' }}>Invoice #</th>
                            <th style={{ padding: '12px 16px' }}>Patient</th>
                            <th style={{ padding: '12px 16px' }}>Date</th>
                            <th style={{ padding: '12px 16px' }}>Line Items</th>
                            <th style={{ padding: '12px 16px' }}>Total Amount</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.map(inv => (
                            <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#1e3a8a' }}>{inv.invoiceNumber || inv._id.slice(-6)}</td>
                                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{inv.patientName}</td>
                                <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(inv.date).toLocaleDateString()}</td>
                                <td style={{ padding: '12px 16px', color: '#64748b' }}>
                                    {inv.items?.length || 0} item(s)
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#0f172a' }}>₹{inv.totalAmount.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        background: inv.status === 'Paid' ? '#dcfce7' : '#fef3c7',
                                        color: inv.status === 'Paid' ? '#15803d' : '#b45309'
                                    }}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                        {inv.status === 'Pending' && (
                                            <button
                                                onClick={() => openSandboxPayment(inv)}
                                                style={{
                                                    background: '#16a34a',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <FaCreditCard /> Pay (Sandbox)
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDownloadPDF(inv._id, inv.invoiceNumber)}
                                            title="Download Itemized PDF Receipt"
                                            style={{
                                                background: '#f1f5f9',
                                                color: '#1e293b',
                                                border: '1px solid #cbd5e1',
                                                padding: '6px 10px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <FaFilePdf style={{ color: '#ef4444' }} /> PDF
                                        </button>
                                        <button
                                            onClick={() => handleDelete(inv._id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '4px 6px'
                                            }}
                                            title="Delete Invoice"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {invoices.length === 0 && !loading && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    No invoices generated yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sandbox Payment Modal */}
            {paymentModal.isOpen && paymentModal.invoice && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '420px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d' }}>
                                <FaMoneyCheckAlt /> Simulated Sandbox Payment
                            </h3>
                            <button onClick={() => setPaymentModal({ isOpen: false, invoice: null, method: 'Card', processing: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <FaTimes />
                            </button>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.2rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Invoice Reference: <strong>{paymentModal.invoice.invoiceNumber || paymentModal.invoice._id}</strong></div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Patient: <strong>{paymentModal.invoice.patientName}</strong></div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#0f172a', marginTop: '8px' }}>
                                Total Due: ₹{paymentModal.invoice.totalAmount}
                            </div>
                        </div>

                        <form onSubmit={handleSandboxPaymentSubmit}>
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                                    Select Simulated Payment Method
                                </label>
                                <select
                                    value={paymentModal.method}
                                    onChange={(e) => setPaymentModal(prev => ({ ...prev, method: e.target.value }))}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                >
                                    <option value="Card">Credit / Debit Card (Sandbox Visa/Mastercard)</option>
                                    <option value="UPI">UPI / QR Code Simulation</option>
                                    <option value="NetBanking">Net Banking (Sandbox)</option>
                                    <option value="Cash">Cash at Reception Desk</option>
                                </select>
                            </div>

                            <p style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginBottom: '1.2rem' }}>
                                * Simulated sandbox gateway verifies exact line item reconciliation before marking invoice Paid and linking to patient encounter.
                            </p>

                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button
                                    type="submit"
                                    disabled={paymentModal.processing}
                                    style={{
                                        flex: 1,
                                        background: '#16a34a',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {paymentModal.processing ? 'Processing...' : `Authorize ₹${paymentModal.invoice.totalAmount}`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentModal({ isOpen: false, invoice: null, method: 'Card', processing: false })}
                                    style={{
                                        flex: 1,
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Itemized Invoice Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '600px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                            <h3 style={{ margin: 0, color: '#1e3a8a' }}>Generate Itemized Invoice</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Patient Name</label>
                                    <input
                                        type="text"
                                        name="patientName"
                                        placeholder="Full Name"
                                        value={formData.patientName}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Invoice Date</label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                </div>
                            </div>

                            {/* Itemized Line Items */}
                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1e293b' }}>Itemized Line Items</span>
                                    <button type="button" onClick={addItem} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        + Add Line Item
                                    </button>
                                </div>

                                {formData.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            placeholder="Service / Medicine / Diagnostic"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                            required
                                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                            required
                                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Unit Price (₹)"
                                            min="0"
                                            value={item.unitPrice}
                                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                            required
                                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                        />
                                        {formData.items.length > 1 && (
                                            <button type="button" onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <FaTrash />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <div style={{ marginTop: '0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#475569' }}>
                                    Subtotal: <strong>₹{calculateFormSubtotal().toFixed(2)}</strong>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Tax / GST (₹)</label>
                                    <input
                                        type="number"
                                        name="tax"
                                        min="0"
                                        value={formData.tax}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Discount (₹)</label>
                                    <input
                                        type="number"
                                        name="discount"
                                        min="0"
                                        value={formData.discount}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ textAlign: 'right', padding: '0.8rem', background: '#eff6ff', borderRadius: '6px', fontSize: '1.2rem', fontWeight: 'bold', color: '#1e40af' }}>
                                Reconciled Total: ₹{calculateFormTotal().toFixed(2)}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Save & Issue Invoice
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BillingManagement;

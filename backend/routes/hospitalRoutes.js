const express = require('express');
const router = express.Router();
const { protect, hospitalOnly, allow } = require('../middleware/auth');
const {
    registerHospital,
    loginHospital,
    getHospitalProfile,
    updateHospitalProfile,
    changePassword,
    getAllStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    getAllAppointments,
    getAuditLogs,
    getHospitalReports,
    getDepartments,
    createDepartment
} = require('../controllers/hospitalController');
const { getHospitalStats } = require('../controllers/dashboardController');
const {
    createInvoice,
    getInvoices,
    getInvoiceById,
    updateInvoice,
    deleteInvoice,
    getBillableAppointments,
    processSandboxPayment,
    generateInvoicePDF
} = require('../controllers/billingController');

// Public routes
router.post('/register', registerHospital);
router.post('/login', loginHospital);

// Protected routes (Hospital Admin / Staff)
router.use(protect);

// Hospital Profile & Config (Hospital Admin Only)
router.get('/profile', hospitalOnly, getHospitalProfile);
router.put('/profile', hospitalOnly, updateHospitalProfile);
router.put('/change-password', hospitalOnly, changePassword);
router.get('/stats', allow('hospital_admin'), getHospitalStats);

// Staff Directory Management
router.get('/staff', allow('hospital_admin'), getAllStaff);
router.post('/staff', hospitalOnly, addStaff);
router.put('/staff/:id', hospitalOnly, updateStaff);
router.delete('/staff/:id', hospitalOnly, deleteStaff);

// Departments
router.get('/departments', allow('hospital_admin', 'receptionist', 'doctor'), getDepartments);
router.post('/departments', hospitalOnly, createDepartment);

// Appointments Overview
router.get('/appointments', allow('hospital_admin'), getAllAppointments);

// Billing & Invoices (Itemized invoices, sandbox payment flow, PDF generation)
router.post('/invoices', allow('hospital_admin', 'billing', 'receptionist'), createInvoice);
router.get('/invoices', allow('hospital_admin', 'billing', 'receptionist'), getInvoices);
router.get('/invoices/:id', allow('hospital_admin', 'billing', 'receptionist'), getInvoiceById);
router.get('/invoices/:id/pdf', allow('hospital_admin', 'billing', 'receptionist', 'doctor'), generateInvoicePDF);
router.post('/invoices/:id/sandbox-pay', allow('hospital_admin', 'billing', 'receptionist'), processSandboxPayment);
router.put('/invoices/:id', allow('hospital_admin', 'billing'), updateInvoice);
router.delete('/invoices/:id', hospitalOnly, deleteInvoice);
router.get('/billable-appointments', allow('hospital_admin', 'billing', 'receptionist'), getBillableAppointments);

// Audit & Reporting
router.get('/audit-logs', allow('hospital_admin', 'super_admin'), getAuditLogs);
router.get('/reports/summary', allow('hospital_admin', 'super_admin'), getHospitalReports);

module.exports = router;

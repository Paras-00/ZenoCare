const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/auth');
const {
    registerPatient,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
    searchPatients,
    getDoctors,
    getAvailableDoctorSlots,
    getAllPatients,
    getPatientById,
    getReceptionAppointments,
    updatePatient,
    deletePatient
} = require('../controllers/receptionController');
const { getReceptionStats } = require('../controllers/dashboardController');

// All reception routes require authentication
router.use(protect);

// Shared Read routes (Front-Desk, Hospital Admin, Clinician)
router.get('/stats', allow('Receptionist', 'receptionist', 'hospital_admin'), getReceptionStats);
router.get('/patients', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), getAllPatients);
router.get('/patients/search', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), searchPatients);
router.get('/patients/:id', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), getPatientById);
router.get('/doctors', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), getDoctors);
router.get('/doctors/:id/available-slots', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), getAvailableDoctorSlots);
router.get('/appointments', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), getReceptionAppointments);

// Front-Desk / Admin Write Operations
router.post('/patients', allow('Receptionist', 'receptionist', 'hospital_admin'), registerPatient);
router.post('/appointments', allow('Receptionist', 'receptionist', 'hospital_admin'), bookAppointment);
router.put('/appointments/:id/reschedule', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), rescheduleAppointment);
router.put('/appointments/:id/cancel', allow('Receptionist', 'receptionist', 'hospital_admin', 'doctor'), cancelAppointment);
router.put('/patients/:id', allow('Receptionist', 'receptionist', 'hospital_admin'), updatePatient);
router.delete('/patients/:id', allow('Receptionist', 'receptionist', 'hospital_admin'), deletePatient);

module.exports = router;

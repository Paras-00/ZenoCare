const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/auth');
const {
    getDoctorAppointments,
    getDoctorStats,
    addPrescription,
    createOrUpdateVisitRecord,
    getVisitRecord,
    getDoctorPatients,
    getPatientHistory,
    updateAppointmentStatus,
    getNextAppointment,
    getRecentPatients
} = require('../controllers/doctorController');

// All routes are protected and for Doctors only
router.use(protect);
router.use(allow('doctor', 'Doctor'));

router.get('/stats', getDoctorStats);
router.get('/appointments', getDoctorAppointments);
router.post('/appointments/:id/prescription', addPrescription);
router.post('/appointments/:id/visit', createOrUpdateVisitRecord);
router.get('/appointments/:id/visit', getVisitRecord);
router.get('/patients', getDoctorPatients);
router.get('/patients/:id/history', getPatientHistory);
router.put('/appointments/:id/status', updateAppointmentStatus);
router.get('/next-appointment', getNextAppointment);
router.get('/recent-patients', getRecentPatients);

module.exports = router;

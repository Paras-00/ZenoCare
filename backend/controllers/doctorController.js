const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const VisitRecord = require('../models/VisitRecord');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get doctor's appointments
// @route   GET /api/doctor/appointments
// @access  Private (Doctor)
exports.getDoctorAppointments = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const { date, status } = req.query;

        const query = { doctorId };
        if (status) query.status = status;

        if (date === 'today') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
        }

        const appointments = await Appointment.find(query)
            .populate('patientId', 'firstName lastName dateOfBirth age gender phone bloodGroup medicalHistory patientId')
            .populate('visitRecordId')
            .sort({ appointmentDate: 1, appointmentTime: 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments
        });
    } catch (error) {
        console.error('Get doctor appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments'
        });
    }
};

// @desc    Get doctor statistics
// @route   GET /api/doctor/stats
// @access  Private (Doctor)
exports.getDoctorStats = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayAppointments = await Appointment.countDocuments({
            doctorId,
            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'Cancelled' }
        });

        const pendingReports = await Appointment.countDocuments({
            doctorId,
            status: { $in: ['Scheduled', 'Confirmed', 'In Progress'] }
        });

        const completedAppointments = await Appointment.countDocuments({
            doctorId,
            status: 'Completed'
        });

        res.status(200).json({
            success: true,
            data: {
                todayAppointments,
                pendingReports,
                completedAppointments
            }
        });
    } catch (error) {
        console.error('Get doctor stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctor stats'
        });
    }
};

// @desc    Create or update full clinical visit record (encounters, notes, vitals, prescriptions, diagnostic metadata)
// @route   POST /api/doctor/appointments/:id/visit
// @access  Private (Doctor Only)
exports.createOrUpdateVisitRecord = async (req, res) => {
    try {
        const { id: appointmentId } = req.params;
        const doctorId = req.user.id;
        const hospitalId = req.user.hospitalId;

        const {
            encounterDate,
            visitType,
            chiefComplaint,
            vitals,
            clinicianNotes,
            prescriptions,
            diagnosticReports,
            followUpDate,
            markCompleted
        } = req.body;

        const appointment = await Appointment.findOne({ _id: appointmentId, doctorId, hospitalId });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not assigned to this doctor'
            });
        }

        // Find or create VisitRecord
        let visitRecord = await VisitRecord.findOne({ appointmentId });

        if (visitRecord) {
            if (encounterDate) visitRecord.encounterDate = encounterDate;
            if (visitType) visitRecord.visitType = visitType;
            if (chiefComplaint) visitRecord.chiefComplaint = chiefComplaint;
            if (vitals) visitRecord.vitals = { ...visitRecord.vitals, ...vitals };
            if (clinicianNotes) visitRecord.clinicianNotes = { ...visitRecord.clinicianNotes, ...clinicianNotes };
            if (prescriptions) visitRecord.prescriptions = prescriptions;
            if (diagnosticReports) visitRecord.diagnosticReports = diagnosticReports;
            if (followUpDate) visitRecord.followUpDate = followUpDate;

            await visitRecord.save();
        } else {
            visitRecord = await VisitRecord.create({
                hospitalId,
                appointmentId,
                patientId: appointment.patientId,
                doctorId,
                encounterDate: encounterDate || new Date(),
                visitType: visitType || appointment.appointmentType || 'Consultation',
                chiefComplaint: chiefComplaint || appointment.reason || 'General Consultation',
                vitals: vitals || {},
                clinicianNotes: clinicianNotes || {},
                prescriptions: prescriptions || [],
                diagnosticReports: diagnosticReports || [],
                followUpDate
            });
        }

        // Link visitRecord to appointment and update status
        appointment.visitRecordId = visitRecord._id;
        if (prescriptions && prescriptions.length > 0) {
            appointment.prescription = prescriptions;
        }
        if (clinicianNotes?.assessment) {
            appointment.diagnosis = clinicianNotes.assessment;
        }
        if (markCompleted !== false) {
            appointment.status = 'Completed';
        }
        await appointment.save();

        // Update Patient's lastVisit
        await Patient.findByIdAndUpdate(appointment.patientId, {
            lastVisit: visitRecord.encounterDate || new Date()
        });

        // Audit Trail: Record creation/update of sensitive clinical visit record
        await logAudit({
            req,
            action: 'VISIT_RECORD_CREATE',
            resourceType: 'VisitRecord',
            resourceId: visitRecord._id,
            patientId: appointment.patientId,
            details: {
                appointmentId,
                chiefComplaint: visitRecord.chiefComplaint,
                prescriptionsCount: visitRecord.prescriptions?.length || 0,
                diagnosticReportsCount: visitRecord.diagnosticReports?.length || 0
            }
        });

        res.status(200).json({
            success: true,
            message: 'Clinical visit record saved successfully',
            data: visitRecord
        });
    } catch (error) {
        console.error('Save visit record error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error saving visit record'
        });
    }
};

// @desc    Get visit record for an appointment
// @route   GET /api/doctor/appointments/:id/visit
// @access  Private (Doctor, Hospital Admin)
exports.getVisitRecord = async (req, res) => {
    try {
        const { id: appointmentId } = req.params;
        const hospitalId = req.user.hospitalId;

        const visitRecord = await VisitRecord.findOne({ appointmentId, hospitalId })
            .populate('patientId', 'firstName lastName dateOfBirth gender bloodGroup patientId')
            .populate('doctorId', 'firstName lastName specialization');

        if (!visitRecord) {
            return res.status(404).json({
                success: false,
                message: 'No visit record found for this appointment'
            });
        }

        // Audit Trail: Read sensitive clinical visit record
        await logAudit({
            req,
            action: 'PATIENT_VIEW',
            resourceType: 'VisitRecord',
            resourceId: visitRecord._id,
            patientId: visitRecord.patientId?._id,
            details: { encounterDate: visitRecord.encounterDate }
        });

        res.status(200).json({
            success: true,
            data: visitRecord
        });
    } catch (error) {
        console.error('Get visit record error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching visit record'
        });
    }
};

// @desc    Add prescription to appointment (legacy / quick prescription)
// @route   POST /api/doctor/appointments/:id/prescription
// @access  Private (Doctor)
exports.addPrescription = async (req, res) => {
    try {
        const { id } = req.params;
        const { prescription, diagnosis, notes, tests } = req.body;
        const doctorId = req.user.id;

        const appointment = await Appointment.findOne({ _id: id, doctorId });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        if (prescription) appointment.prescription = prescription;
        if (diagnosis) appointment.diagnosis = diagnosis;
        if (notes) appointment.notes = notes;
        if (tests) appointment.tests = tests;
        appointment.status = 'Completed';

        await appointment.save();

        // Also create / update corresponding VisitRecord
        let visitRecord = await VisitRecord.findOne({ appointmentId: id });
        if (!visitRecord) {
            visitRecord = await VisitRecord.create({
                hospitalId: appointment.hospitalId,
                appointmentId: appointment._id,
                patientId: appointment.patientId,
                doctorId: appointment.doctorId,
                encounterDate: appointment.appointmentDate || new Date(),
                chiefComplaint: appointment.reason,
                clinicianNotes: { assessment: diagnosis || '', plan: notes || '' },
                prescriptions: prescription || [],
                diagnosticReports: tests?.map(t => ({ testName: t.testName || t, status: t.status || 'Ordered' })) || []
            });
            appointment.visitRecordId = visitRecord._id;
            await appointment.save();
        }

        // Audit Trail
        await logAudit({
            req,
            action: 'VISIT_RECORD_UPDATE',
            resourceType: 'Appointment',
            resourceId: appointment._id,
            patientId: appointment.patientId,
            details: { diagnosis, prescriptionsCount: prescription?.length || 0 }
        });

        res.status(200).json({
            success: true,
            message: 'Prescription saved and visit completed successfully',
            data: appointment
        });
    } catch (error) {
        console.error('Add prescription error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding prescription'
        });
    }
};

// @desc    Get patients treated by doctor
// @route   GET /api/doctor/patients
// @access  Private (Doctor)
exports.getDoctorPatients = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const hospitalId = req.user.hospitalId;

        const appointments = await Appointment.find({ doctorId, hospitalId }).select('patientId');
        const validAppointments = appointments.filter(apt => apt.patientId);
        const uniquePatientIds = [...new Set(validAppointments.map(apt => apt.patientId.toString()))];

        const patients = await Patient.find({
            _id: { $in: uniquePatientIds }
        }).select('patientId firstName lastName dateOfBirth age gender phone email bloodGroup lastVisit');

        res.status(200).json({
            success: true,
            count: patients.length,
            data: patients
        });
    } catch (error) {
        console.error('Get doctor patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching patients'
        });
    }
};

// @desc    Get patient history (consultations, visit records, diagnoses)
// @route   GET /api/doctor/patients/:id/history
// @access  Private (Doctor, Hospital Admin)
exports.getPatientHistory = async (req, res) => {
    try {
        const { id: patientId } = req.params;
        const hospitalId = req.user.hospitalId;

        const patient = await Patient.findOne({ _id: patientId, hospitalId });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        const history = await Appointment.find({ patientId, hospitalId })
            .populate('doctorId', 'firstName lastName specialization')
            .populate('visitRecordId')
            .sort({ appointmentDate: -1 });

        const visitRecords = await VisitRecord.find({ patientId, hospitalId })
            .populate('doctorId', 'firstName lastName specialization')
            .sort({ encounterDate: -1 });

        // Audit Trail: Sensitive patient history access
        await logAudit({
            req,
            action: 'PATIENT_VIEW',
            resourceType: 'Patient',
            resourceId: patient._id,
            patientId: patient._id,
            details: { recordsCount: history.length }
        });

        res.status(200).json({
            success: true,
            patient,
            count: history.length,
            data: history,
            visitRecords
        });
    } catch (error) {
        console.error('Get patient history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching patient history'
        });
    }
};

// @desc    Update appointment status
// @route   PUT /api/doctor/appointments/:id/status
// @access  Private (Doctor)
exports.updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const doctorId = req.user.id;

        const appointment = await Appointment.findOne({ _id: id, doctorId });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        const validStatuses = ['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        appointment.status = status;
        await appointment.save();

        res.status(200).json({
            success: true,
            message: `Appointment marked as ${status}`,
            data: appointment
        });
    } catch (error) {
        console.error('Update appointment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating appointment status'
        });
    }
};

// @desc    Get next scheduled appointment
// @route   GET /api/doctor/next-appointment
// @access  Private (Doctor)
exports.getNextAppointment = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const appointment = await Appointment.findOne({
            doctorId,
            appointmentDate: { $gte: startOfDay },
            status: { $in: ['Scheduled', 'Confirmed', 'In Progress'] }
        })
            .populate('patientId', 'firstName lastName age gender phone bloodGroup patientId')
            .sort({ appointmentDate: 1, appointmentTime: 1 });

        res.status(200).json({
            success: true,
            data: appointment
        });
    } catch (error) {
        console.error('Get next appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching next appointment'
        });
    }
};

// @desc    Get recent patients
// @route   GET /api/doctor/recent-patients
// @access  Private (Doctor)
exports.getRecentPatients = async (req, res) => {
    try {
        const doctorId = req.user.id;

        const appointments = await Appointment.find({
            doctorId,
            status: 'Completed'
        })
            .sort({ appointmentDate: -1, appointmentTime: -1 })
            .populate('patientId', 'firstName lastName age gender bloodGroup patientId lastVisit');

        const uniquePatients = [];
        const seenIds = new Set();

        for (const apt of appointments) {
            if (apt.patientId && !seenIds.has(apt.patientId._id.toString())) {
                const patientData = apt.patientId.toObject ? apt.patientId.toObject() : apt.patientId;
                uniquePatients.push({
                    ...patientData,
                    lastAppointmentDate: apt.appointmentDate
                });
                seenIds.add(apt.patientId._id.toString());
            }
            if (uniquePatients.length >= 6) break;
        }

        res.status(200).json({
            success: true,
            data: uniquePatients
        });
    } catch (error) {
        console.error('Get recent patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recent patients'
        });
    }
};

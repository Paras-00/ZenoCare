const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { logAudit } = require('../utils/auditLogger');

// Helper to normalize date to YYYY-MM-DD
const normalizeDateString = (dateInput) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to generate time slots between start and end
const generateTimeSlots = (startTime = '09:00', endTime = '17:00', intervalMinutes = 30) => {
    const slots = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let current = new Date();
    current.setHours(startH, startM, 0, 0);

    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
        const h = String(current.getHours()).padStart(2, '0');
        const m = String(current.getMinutes()).padStart(2, '0');
        slots.push(`${h}:${m}`);
        current = new Date(current.getTime() + intervalMinutes * 60000);
    }

    return slots;
};

// @desc    Get available slots for a doctor on a specific date
// @route   GET /api/reception/doctors/:id/available-slots
// @access  Private (Receptionist, Hospital Admin, Doctor)
exports.getAvailableDoctorSlots = async (req, res) => {
    try {
        const { id: doctorId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a date query (YYYY-MM-DD)'
            });
        }

        const normalizedDate = normalizeDateString(date);
        if (!normalizedDate) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Expected YYYY-MM-DD.'
            });
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Determine day of the week
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const targetDate = new Date(`${normalizedDate}T00:00:00`);
        const dayOfWeek = days[targetDate.getDay()];

        // Find doctor schedule for this day
        let daySchedule = doctor.schedule?.find(s => s.day === dayOfWeek);

        // Fallback default schedule if none defined
        if (!daySchedule) {
            daySchedule = {
                day: dayOfWeek,
                startTime: '09:00',
                endTime: dayOfWeek === 'Sunday' ? '13:00' : '17:00',
                isAvailable: dayOfWeek !== 'Sunday' // Sunday closed by default if not set
            };
        }

        if (!daySchedule.isAvailable) {
            return res.status(200).json({
                success: true,
                date: normalizedDate,
                dayOfWeek,
                isAvailable: false,
                message: `Dr. ${doctor.firstName} ${doctor.lastName} is not scheduled for consultations on ${dayOfWeek}s`,
                availableSlots: [],
                bookedSlots: []
            });
        }

        const duration = doctor.consultationDuration || 30;
        const allSlots = generateTimeSlots(daySchedule.startTime, daySchedule.endTime, duration);

        // Find existing non-cancelled appointments for this doctor on this day
        const startOfDay = new Date(`${normalizedDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${normalizedDate}T23:59:59.999Z`);

        const bookedAppointments = await Appointment.find({
            doctorId,
            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'Cancelled' }
        }).select('appointmentTime status patientId');

        const bookedTimes = bookedAppointments.map(a => a.appointmentTime);

        // Check if date is today and filter out past time slots
        const now = new Date();
        const todayStr = normalizeDateString(now);
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMins = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMins}`;

        const availableSlots = allSlots.filter(slot => {
            if (bookedTimes.includes(slot)) return false;
            if (normalizedDate === todayStr && slot <= currentTimeStr) return false;
            return true;
        });

        res.status(200).json({
            success: true,
            date: normalizedDate,
            dayOfWeek,
            isAvailable: true,
            doctor: {
                id: doctor._id,
                name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
                specialization: doctor.specialization,
                consultationFee: doctor.consultationFee || 500,
                duration
            },
            allSlots,
            bookedSlots: bookedTimes,
            availableSlots
        });
    } catch (error) {
        console.error('Error fetching available slots:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching available slots'
        });
    }
};

// @desc    Register a new patient
// @route   POST /api/reception/patients
// @access  Private (Receptionist, Hospital Admin)
exports.registerPatient = async (req, res) => {
    try {
        const { firstName, lastName, dateOfBirth, gender, phone, email, address, bloodGroup, medicalHistory } = req.body;
        const hospitalId = req.user.hospitalId;

        // Basic validation
        if (!firstName || !dateOfBirth || !gender || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields (firstName, dateOfBirth, gender, phone)'
            });
        }

        // Check if patient exists in this hospital (by phone)
        const existingPatient = await Patient.findOne({ phone, hospitalId });
        if (existingPatient) {
            return res.status(400).json({
                success: false,
                message: 'Patient with this phone number already registered in this hospital'
            });
        }

        // Generate synthetic readable Patient ID: PID-YYYYMMDD-XXXX
        const rand = Math.floor(1000 + Math.random() * 9000);
        const patientId = `PID-${Date.now().toString().slice(-6)}-${rand}`;

        const patient = await Patient.create({
            patientId,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            phone,
            email,
            address,
            bloodGroup,
            medicalHistory,
            hospitalId,
            registeredBy: req.user.id
        });

        // Audit Trail
        await logAudit({
            req,
            action: 'PATIENT_CREATE',
            resourceType: 'Patient',
            resourceId: patient._id,
            patientId: patient._id,
            details: { patientId: patient.patientId, name: `${firstName} ${lastName || ''}`.trim(), phone }
        });

        res.status(201).json({
            success: true,
            message: 'Patient registered successfully',
            data: patient
        });
    } catch (error) {
        console.error('Register patient error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error registering patient'
        });
    }
};

// @desc    Book an appointment (with concurrency conflict protection)
// @route   POST /api/reception/appointments
// @access  Private (Receptionist, Hospital Admin)
exports.bookAppointment = async (req, res) => {
    try {
        const { patientId, doctorId, date, time, reason, appointmentType, consultationFee } = req.body;
        const hospitalId = req.user.hospitalId;

        // Validate
        if (!patientId || !doctorId || !date || !time || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Please provide patientId, doctorId, date, time, and reason'
            });
        }

        const normalizedDate = normalizeDateString(date);
        if (!normalizedDate) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appointment date format'
            });
        }

        // Prevent past booking
        const todayStr = normalizeDateString(new Date());
        if (normalizedDate < todayStr) {
            return res.status(400).json({
                success: false,
                message: 'Cannot book appointment in the past'
            });
        }

        // Verify Doctor exists and belongs to hospital
        const doctor = await Doctor.findOne({ _id: doctorId, hospitalId });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found in this hospital'
            });
        }

        // Verify Patient exists
        const patient = await Patient.findOne({ _id: patientId, hospitalId });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        // Construct unique slotKey: <doctorId>_<YYYY-MM-DD>_<time>
        const slotKey = `${doctorId.toString()}_${normalizedDate}_${time}`;

        // Check if slot is taken (pre-check before atomic insert)
        const existingAppointment = await Appointment.findOne({
            slotKey,
            status: { $ne: 'Cancelled' }
        });

        if (existingAppointment) {
            return res.status(409).json({
                success: false,
                message: `This time slot (${time} on ${normalizedDate}) is already booked for Dr. ${doctor.firstName} ${doctor.lastName}`
            });
        }

        const appointmentDateObj = new Date(`${normalizedDate}T00:00:00.000Z`);

        const appointment = await Appointment.create({
            hospitalId,
            patientId,
            doctorId,
            departmentId: doctor.departmentId,
            appointmentDate: appointmentDateObj,
            appointmentTime: time,
            slotKey,
            activeSlotKey: slotKey,
            reason,
            appointmentType: appointmentType || 'Consultation',
            consultationFee: consultationFee || doctor.consultationFee || 500,
            createdBy: req.user.id,
            status: 'Scheduled'
        });

        // Audit Trail
        await logAudit({
            req,
            action: 'APPOINTMENT_BOOK',
            resourceType: 'Appointment',
            resourceId: appointment._id,
            patientId: patient._id,
            details: {
                doctorId,
                doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
                appointmentDate: normalizedDate,
                appointmentTime: time,
                slotKey
            }
        });

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            data: appointment
        });

    } catch (error) {
        // Handle MongoDB duplicate key error (code 11000) for race conditions
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Conflicting appointment: This doctor slot was just booked by another concurrent request.'
            });
        }
        console.error('Book appointment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error booking appointment'
        });
    }
};

// @desc    Reschedule an existing appointment
// @route   PUT /api/reception/appointments/:id/reschedule
// @access  Private (Receptionist, Hospital Admin, Doctor)
exports.rescheduleAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { newDate, newTime, reason } = req.body;
        const hospitalId = req.user.hospitalId;

        if (!newDate || !newTime) {
            return res.status(400).json({
                success: false,
                message: 'Please provide newDate and newTime'
            });
        }

        const appointment = await Appointment.findOne({ _id: id, hospitalId });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        if (['Completed', 'Cancelled'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot reschedule an appointment with status '${appointment.status}'`
            });
        }

        const normalizedNewDate = normalizeDateString(newDate);
        if (!normalizedNewDate) {
            return res.status(400).json({
                success: false,
                message: 'Invalid newDate format'
            });
        }

        // Check if new slot is taken
        const newSlotKey = `${appointment.doctorId.toString()}_${normalizedNewDate}_${newTime}`;
        const slotConflict = await Appointment.findOne({
            _id: { $ne: id },
            slotKey: newSlotKey,
            status: { $ne: 'Cancelled' }
        });

        if (slotConflict) {
            return res.status(409).json({
                success: false,
                message: `The target slot (${newTime} on ${normalizedNewDate}) is already booked.`
            });
        }

        // Store previous schedule info
        appointment.rescheduledFrom = {
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime,
            rescheduledAt: new Date()
        };

        appointment.appointmentDate = new Date(`${normalizedNewDate}T00:00:00.000Z`);
        appointment.appointmentTime = newTime;
        appointment.slotKey = newSlotKey;
        appointment.activeSlotKey = newSlotKey;
        if (reason) appointment.reason = `${appointment.reason} [Rescheduled: ${reason}]`;
        appointment.status = 'Scheduled';

        await appointment.save();

        // Audit Trail
        await logAudit({
            req,
            action: 'APPOINTMENT_RESCHEDULE',
            resourceType: 'Appointment',
            resourceId: appointment._id,
            patientId: appointment.patientId,
            details: {
                previous: appointment.rescheduledFrom,
                newDate: normalizedNewDate,
                newTime,
                newSlotKey
            }
        });

        res.status(200).json({
            success: true,
            message: 'Appointment rescheduled successfully',
            data: appointment
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Conflicting appointment: The target slot is already booked.'
            });
        }
        console.error('Reschedule appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rescheduling appointment'
        });
    }
};

// @desc    Cancel an appointment
// @route   PUT /api/reception/appointments/:id/cancel
// @access  Private (Receptionist, Hospital Admin, Doctor)
exports.cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const hospitalId = req.user.hospitalId;

        const appointment = await Appointment.findOne({ _id: id, hospitalId });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        if (appointment.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Appointment is already cancelled'
            });
        }

        appointment.status = 'Cancelled';
        appointment.activeSlotKey = undefined;
        appointment.cancellationReason = reason || 'Cancelled by staff request';
        appointment.cancelledBy = req.user.role === 'doctor' ? 'Doctor' : (req.user.role === 'hospital_admin' ? 'Hospital' : 'Receptionist');
        appointment.cancelledAt = new Date();

        await appointment.save();

        // Audit Trail
        await logAudit({
            req,
            action: 'APPOINTMENT_CANCEL',
            resourceType: 'Appointment',
            resourceId: appointment._id,
            patientId: appointment.patientId,
            details: {
                reason: appointment.cancellationReason,
                cancelledBy: appointment.cancelledBy,
                cancelledAt: appointment.cancelledAt
            }
        });

        res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully. Slot is now free.',
            data: appointment
        });
    } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling appointment'
        });
    }
};

// @desc    Search patients with query and filtering
// @route   GET /api/reception/patients/search
// @access  Private (Receptionist, Hospital Admin, Doctor)
exports.searchPatients = async (req, res) => {
    try {
        const { query, bloodGroup, gender } = req.query;
        const hospitalId = req.user.hospitalId;

        const filter = { hospitalId };

        if (query) {
            filter.$or = [
                { firstName: { $regex: query, $options: 'i' } },
                { lastName: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } },
                { patientId: { $regex: query, $options: 'i' } }
            ];
        }

        if (bloodGroup) filter.bloodGroup = bloodGroup;
        if (gender) filter.gender = gender;

        const patients = await Patient.find(filter)
            .select('patientId firstName lastName dateOfBirth gender phone email bloodGroup address createdAt')
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            count: patients.length,
            data: patients
        });
    } catch (error) {
        console.error('Search patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching patients'
        });
    }
};

// @desc    Get single patient details (with audit logging of sensitive health data access)
// @route   GET /api/reception/patients/:id
// @access  Private (Receptionist, Hospital Admin, Doctor)
exports.getPatientById = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospitalId;

        const patient = await Patient.findOne({ _id: id, hospitalId });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        // Audit Trail: Record access to sensitive patient record
        await logAudit({
            req,
            action: 'PATIENT_VIEW',
            resourceType: 'Patient',
            resourceId: patient._id,
            patientId: patient._id,
            details: { patientId: patient.patientId, name: `${patient.firstName} ${patient.lastName || ''}`.trim() }
        });

        res.status(200).json({
            success: true,
            data: patient
        });
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching patient details'
        });
    }
};

// @desc    Get all patients
// @route   GET /api/reception/patients
// @access  Private (Receptionist, Hospital Admin, Doctor)
exports.getAllPatients = async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const total = await Patient.countDocuments({ hospitalId });
        const patients = await Patient.find({ hospitalId })
            .select('firstName lastName age dateOfBirth gender phone email patientId bloodGroup address lastVisit createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            count: patients.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: patients
        });
    } catch (error) {
        console.error('Get all patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching patients'
        });
    }
};

// @desc    Get doctors for reception booking
// @route   GET /api/reception/doctors
// @access  Private
exports.getDoctors = async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId;
        const doctors = await Doctor.find({ hospitalId, isActive: true })
            .select('firstName lastName specialization qualification experience departmentId consultationFee schedule')
            .sort({ firstName: 1 });

        res.status(200).json({
            success: true,
            count: doctors.length,
            data: doctors
        });
    } catch (error) {
        console.error('Get doctors error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctors'
        });
    }
};

// @desc    Get appointments for reception
// @route   GET /api/reception/appointments
// @access  Private
exports.getReceptionAppointments = async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId;
        const { date, status, doctorId } = req.query;

        let query = { hospitalId };

        if (status) query.status = status;
        if (doctorId) query.doctorId = doctorId;

        if (date === 'today') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
        } else if (date && date !== 'all') {
            const normalized = normalizeDateString(date);
            if (normalized) {
                const start = new Date(`${normalized}T00:00:00.000Z`);
                const end = new Date(`${normalized}T23:59:59.999Z`);
                query.appointmentDate = { $gte: start, $lte: end };
            }
        }

        const appointments = await Appointment.find(query)
            .populate('patientId', 'firstName lastName phone patientId dateOfBirth gender bloodGroup')
            .populate('doctorId', 'firstName lastName specialization')
            .sort({ appointmentDate: 1, appointmentTime: 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments
        });
    } catch (error) {
        console.error('Get reception appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments'
        });
    }
};

// @desc    Update patient details
// @route   PUT /api/reception/patients/:id
// @access  Private (Receptionist, Hospital Admin)
exports.updatePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const hospitalId = req.user.hospitalId;

        const patient = await Patient.findOne({ _id: id, hospitalId });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        // Prevent updating immutable fields
        delete updates._id;
        delete updates.patientId;
        delete updates.hospitalId;
        delete updates.registeredBy;
        delete updates.createdAt;

        Object.keys(updates).forEach(key => {
            patient[key] = updates[key];
        });

        await patient.save();

        // Audit Trail: Record edit to sensitive patient record
        await logAudit({
            req,
            action: 'PATIENT_UPDATE',
            resourceType: 'Patient',
            resourceId: patient._id,
            patientId: patient._id,
            details: { updatedFields: Object.keys(updates) }
        });

        res.status(200).json({
            success: true,
            message: 'Patient updated successfully',
            data: patient
        });
    } catch (error) {
        console.error('Update patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating patient'
        });
    }
};

// @desc    Delete patient
// @route   DELETE /api/reception/patients/:id
// @access  Private (Hospital Admin, Receptionist)
exports.deletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospitalId;

        const patient = await Patient.findOne({ _id: id, hospitalId });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        await Appointment.deleteMany({ patientId: id, hospitalId });
        await patient.deleteOne();

        // Audit Trail: Record deletion of patient record
        await logAudit({
            req,
            action: 'PATIENT_DELETE',
            resourceType: 'Patient',
            resourceId: id,
            details: { patientId: patient.patientId, name: `${patient.firstName} ${patient.lastName || ''}`.trim() }
        });

        res.status(200).json({
            success: true,
            message: 'Patient and related appointments deleted successfully'
        });
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting patient'
        });
    }
};

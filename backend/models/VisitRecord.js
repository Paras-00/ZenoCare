const mongoose = require('mongoose');

const visitRecordSchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        required: [true, 'Hospital ID is required'],
        index: true
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: [true, 'Appointment ID is required'],
        index: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required'],
        index: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: [true, 'Doctor ID is required'],
        index: true
    },
    encounterDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    visitType: {
        type: String,
        enum: ['Consultation', 'Follow-up', 'Emergency', 'Routine Checkup'],
        default: 'Consultation'
    },
    chiefComplaint: {
        type: String,
        required: [true, 'Chief complaint is required'],
        trim: true
    },
    vitals: {
        bloodPressure: { type: String, trim: true, default: '' },
        heartRate: { type: Number, min: 20, max: 250 },
        temperature: { type: String, trim: true, default: '' },
        respiratoryRate: { type: Number, min: 5, max: 80 },
        spO2: { type: Number, min: 50, max: 100 },
        weight: { type: Number, min: 1, max: 400 },
        height: { type: Number, min: 10, max: 280 }
    },
    clinicianNotes: {
        subjective: { type: String, default: '' },
        objective: { type: String, default: '' },
        assessment: { type: String, default: '' },
        plan: { type: String, default: '' }
    },
    prescriptions: [{
        medicine: { type: String, required: true, trim: true },
        dosage: { type: String, required: true, trim: true },
        frequency: { type: String, required: true, trim: true },
        duration: { type: String, required: true, trim: true },
        instructions: { type: String, default: 'After food', trim: true }
    }],
    diagnosticReports: [{
        testName: { type: String, required: true, trim: true },
        category: { type: String, default: 'Clinical Lab', trim: true },
        status: {
            type: String,
            enum: ['Ordered', 'Sample Collected', 'In Progress', 'Completed'],
            default: 'Ordered'
        },
        resultSummary: { type: String, default: '' },
        reportedAt: { type: Date },
        clinicianNotes: { type: String, default: '' }
    }],
    followUpDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Draft', 'Finalized'],
        default: 'Finalized'
    }
}, {
    timestamps: true
});

visitRecordSchema.index({ hospitalId: 1, patientId: 1, encounterDate: -1 });
visitRecordSchema.index({ hospitalId: 1, doctorId: 1, encounterDate: -1 });

module.exports = mongoose.model('VisitRecord', visitRecordSchema);

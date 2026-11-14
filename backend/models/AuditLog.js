const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        index: true
    },
    userId: {
        type: String,
        required: [true, 'User ID is required']
    },
    userName: {
        type: String,
        default: 'System User'
    },
    userRole: {
        type: String,
        required: [true, 'User role is required']
    },
    action: {
        type: String,
        required: [true, 'Action is required'],
        index: true
    },
    resourceType: {
        type: String,
        required: [true, 'Resource type is required'],
        enum: ['Patient', 'Appointment', 'VisitRecord', 'Invoice']
    },
    resourceId: {
        type: mongoose.Schema.Types.Mixed
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: '127.0.0.1'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

auditLogSchema.index({ hospitalId: 1, timestamp: -1 });
auditLogSchema.index({ hospitalId: 1, action: 1 });
auditLogSchema.index({ hospitalId: 1, patientId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

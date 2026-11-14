const AuditLog = require('../models/AuditLog');

const logAudit = async ({
    req,
    action,
    resourceType,
    resourceId,
    patientId,
    details = {}
}) => {
    try {
        const user = req?.user || {};
        const hospitalId = user.hospitalId || (user.role === 'hospital_admin' ? user._id : null);
        const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
        
        let userName = 'System User';
        if (user.name) {
            userName = user.name;
        } else if (user.firstName) {
            userName = `${user.firstName} ${user.lastName || ''}`.trim();
        }

        const logEntry = await AuditLog.create({
            hospitalId,
            userId: user._id ? user._id.toString() : (user.id || 'anonymous'),
            userName,
            userRole: user.role || 'unknown',
            action,
            resourceType,
            resourceId,
            patientId,
            details,
            ipAddress,
            timestamp: new Date()
        });

        return logEntry;
    } catch (err) {
        console.error('Audit log creation error:', err.message);
        return null;
    }
};

module.exports = { logAudit };

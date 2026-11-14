const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');

// Ensure test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'JWT_SECRET_REDACTED';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zenocare';

const app = require('../server');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const Hospital = require('../models/Hospital');

describe('ZenoCare Hospital Management System - Core Acceptance Tests', () => {
    let receptionistToken = '';
    let doctorToken = '';
    let hospitalAdminToken = '';
    let billingToken = '';

    let testHospitalId = '';
    let testDoctorId = '';
    let testPatientId = '';

    before(async () => {
        // Log in Receptionist
        const recRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'reception@zenocare.com', password: 'reception123' });
        assert.strictEqual(recRes.status, 200, 'Receptionist login should succeed');
        receptionistToken = recRes.body.token;

        // Log in Doctor
        const docRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dr.sarah@zenocare.com', password: 'doctor123' });
        assert.strictEqual(docRes.status, 200, 'Doctor login should succeed');
        doctorToken = docRes.body.token;
        testDoctorId = docRes.body.user.id;

        // Log in Hospital Admin
        const hospRes = await request(app)
            .post('/api/hospital/login')
            .send({ email: 'hospital@zenocare.com', password: 'hospital123' });
        assert.strictEqual(hospRes.status, 200, 'Hospital login should succeed');
        hospitalAdminToken = hospRes.body.data.token;
        testHospitalId = hospRes.body.data.hospital._id || hospRes.body.data.hospital.id;

        // Fetch a test patient
        const patient = await Patient.findOne({ hospitalId: testHospitalId });
        assert.ok(patient, 'Seeded patient must exist');
        testPatientId = patient._id.toString();

        // Ensure indexes (including activeSlotKey unique index) are initialized in MongoDB
        await Appointment.init();

        // Clean up any appointments from previous test runs on test-reserved dates
        // so each run starts with a clean slate for the acceptance tests
        await Appointment.deleteMany({
            doctorId: testDoctorId,
            appointmentDate: {
                $gte: new Date('2026-12-01T00:00:00.000Z'),
                $lte: new Date('2026-12-05T23:59:59.999Z')
            }
        });
    });

    // -------------------------------------------------------------
    // ACCEPTANCE TEST 1: Available Doctor Slots & Booking
    // -------------------------------------------------------------
    test('Acceptance Test 1: Search available doctor slots and book a patient into a verified slot', async () => {
        const testDate = '2026-12-01'; // Future Tuesday

        // 1. Search available doctor slots
        const slotsRes = await request(app)
            .get(`/api/reception/doctors/${testDoctorId}/available-slots?date=${testDate}`)
            .set('Authorization', `Bearer ${receptionistToken}`);

        assert.strictEqual(slotsRes.status, 200);
        assert.strictEqual(slotsRes.body.success, true);
        assert.ok(Array.isArray(slotsRes.body.availableSlots));
        assert.ok(slotsRes.body.availableSlots.length > 0, 'Doctor should have available slots on a working day');

        const chosenSlot = slotsRes.body.availableSlots[0];

        // 2. Book appointment into available slot
        const bookRes = await request(app)
            .post('/api/reception/appointments')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                patientId: testPatientId,
                doctorId: testDoctorId,
                date: testDate,
                time: chosenSlot,
                reason: 'Acceptance Test 1: Routine checkup'
            });

        assert.strictEqual(bookRes.status, 201, 'Booking into available slot should return 201');
        assert.strictEqual(bookRes.body.success, true);
        assert.strictEqual(bookRes.body.data.appointmentTime, chosenSlot);
        assert.strictEqual(bookRes.body.data.status, 'Scheduled');

        // 3. Verify slot is now removed from available slots
        const slotsAfterRes = await request(app)
            .get(`/api/reception/doctors/${testDoctorId}/available-slots?date=${testDate}`)
            .set('Authorization', `Bearer ${receptionistToken}`);

        assert.ok(!slotsAfterRes.body.availableSlots.includes(chosenSlot), 'Booked slot must no longer be available');
        assert.ok(slotsAfterRes.body.bookedSlots.includes(chosenSlot), 'Booked slot must appear in bookedSlots list');
    });

    // -------------------------------------------------------------
    // ACCEPTANCE TEST 2: Conflict & Concurrency Prevention
    // -------------------------------------------------------------
    test('Acceptance Test 2: Conflicting appointments for the same doctor/time are prevented, including concurrent attempts', async () => {
        const testDate = '2026-12-02';
        const targetSlot = '11:00';

        // 1. Book initial slot
        const firstBooking = await request(app)
            .post('/api/reception/appointments')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                patientId: testPatientId,
                doctorId: testDoctorId,
                date: testDate,
                time: targetSlot,
                reason: 'First booking for conflict test'
            });

        assert.strictEqual(firstBooking.status, 201);

        // 2. Sequential duplicate attempt should be rejected with 409 Conflict
        const duplicateAttempt = await request(app)
            .post('/api/reception/appointments')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                patientId: testPatientId,
                doctorId: testDoctorId,
                date: testDate,
                time: targetSlot,
                reason: 'Duplicate conflicting booking'
            });

        assert.strictEqual(duplicateAttempt.status, 409, 'Duplicate slot booking must return 409 Conflict');
        assert.strictEqual(duplicateAttempt.body.success, false);

        // 3. Simulated concurrent attempts on a fresh slot
        const concurrentSlot = '14:30';
        const concurrentAttempts = await Promise.all([
            request(app)
                .post('/api/reception/appointments')
                .set('Authorization', `Bearer ${receptionistToken}`)
                .send({
                    patientId: testPatientId,
                    doctorId: testDoctorId,
                    date: testDate,
                    time: concurrentSlot,
                    reason: 'Concurrent booking attempt A'
                }),
            request(app)
                .post('/api/reception/appointments')
                .set('Authorization', `Bearer ${receptionistToken}`)
                .send({
                    patientId: testPatientId,
                    doctorId: testDoctorId,
                    date: testDate,
                    time: concurrentSlot,
                    reason: 'Concurrent booking attempt B'
                })
        ]);

        const statuses = concurrentAttempts.map(r => r.status);
        assert.ok(statuses.includes(201), 'One concurrent attempt should succeed (201)');
        assert.ok(statuses.includes(409), 'The competing concurrent attempt must be rejected with 409 Conflict');
    });

    // -------------------------------------------------------------
    // ACCEPTANCE TEST 3: Server-Side Role-Based Authorization
    // -------------------------------------------------------------
    test('Acceptance Test 3: Only authorized roles can read or update relevant patient/visit information (RBAC)', async () => {
        // Receptionist tries to access or create a clinical doctor visit record -> MUST BE 403 FORBIDDEN
        const unauthorizedVisitCreation = await request(app)
            .post('/api/doctor/appointments/dummyid123/visit')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                chiefComplaint: 'Unauthorized receptionist entering clinical record',
                clinicianNotes: { assessment: 'Hacked diagnosis' }
            });

        assert.strictEqual(unauthorizedVisitCreation.status, 403, 'Receptionist must be denied (403) from creating clinical visit records');

        // Doctor successfully creates clinical visit record for their completed consultation
        // Create an appointment for doctor
        const aptRes = await request(app)
            .post('/api/reception/appointments')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                patientId: testPatientId,
                doctorId: testDoctorId,
                date: '2026-12-05',
                time: '15:00',
                reason: 'Clinical consultation'
            });

        const appointmentId = aptRes.body.data._id;

        const authorizedVisitCreation = await request(app)
            .post(`/api/doctor/appointments/${appointmentId}/visit`)
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({
                visitType: 'Consultation',
                chiefComplaint: 'Exertional chest tightness',
                vitals: {
                    bloodPressure: '128/84 mmHg',
                    heartRate: 74,
                    temperature: '98.6 F',
                    spO2: 98
                },
                clinicianNotes: {
                    subjective: 'Patient reports tightness during steep walking.',
                    objective: 'Chest clear. Normal cardiac sounds S1, S2.',
                    assessment: 'Angina pectoris suspect under clinical observation.',
                    plan: 'Rest, scheduled stress echocardiogram.'
                },
                prescriptions: [
                    { medicine: 'Nitroglycerin sublingual', dosage: '0.4 mg', frequency: 'PRN (As needed)', duration: '15 days', instructions: 'Under tongue' }
                ],
                diagnosticReports: [
                    { testName: 'Exercise Treadmill Stress Test (TMT)', category: 'Cardiology', status: 'Ordered' }
                ]
            });

        assert.strictEqual(authorizedVisitCreation.status, 200, 'Doctor must be authorized (200) to save clinical visit records');
        assert.strictEqual(authorizedVisitCreation.body.success, true);
        assert.strictEqual(authorizedVisitCreation.body.data.chiefComplaint, 'Exertional chest tightness');

        // Receptionist attempts to delete staff member -> MUST BE 403
        const unauthorizedDeleteStaff = await request(app)
            .delete('/api/hospital/staff/dummyid123')
            .set('Authorization', `Bearer ${receptionistToken}`);

        assert.strictEqual(unauthorizedDeleteStaff.status, 403, 'Receptionist must not be authorized to delete staff');
    });

    // -------------------------------------------------------------
    // ACCEPTANCE TEST 4: Invoice Reconciliation & Sandbox Payment
    // -------------------------------------------------------------
    test('Acceptance Test 4: An invoice reconciles with its line items and payment status', async () => {
        // 1. Create an itemized invoice
        const invoicePayload = {
            patientName: 'John Doe',
            patientId: testPatientId,
            items: [
                { description: 'Consultation Fee', quantity: 1, unitPrice: 600, cost: 600 },
                { description: 'Cardiology Diagnostics', quantity: 2, unitPrice: 350, cost: 700 }
            ],
            tax: 50,
            discount: 100
        };

        const createRes = await request(app)
            .post('/api/hospital/invoices')
            .set('Authorization', `Bearer ${hospitalAdminToken}`)
            .send(invoicePayload);

        assert.strictEqual(createRes.status, 201);
        const invoice = createRes.body.data;

        // Verify line items reconciliation: Subtotal (600 + 700 = 1300) + Tax (50) - Discount (100) = 1250
        assert.strictEqual(invoice.subtotal, 1300, 'Subtotal must reconcile with line items sum');
        assert.strictEqual(invoice.totalAmount, 1250, 'Total must reconcile with subtotal + tax - discount');
        assert.strictEqual(invoice.status, 'Pending');

        // 2. Negative test: Payment attempt with mismatched amount must fail with 422
        const invalidPayment = await request(app)
            .post(`/api/hospital/invoices/${invoice._id}/sandbox-pay`)
            .set('Authorization', `Bearer ${hospitalAdminToken}`)
            .send({
                paymentMethod: 'Card',
                amountPaid: 999 // Mismatched amount!
            });

        assert.strictEqual(invalidPayment.status, 422, 'Mismatched payment amount must fail reconciliation (422)');

        // 3. Reconciled Sandbox Payment
        const successfulPayment = await request(app)
            .post(`/api/hospital/invoices/${invoice._id}/sandbox-pay`)
            .set('Authorization', `Bearer ${hospitalAdminToken}`)
            .send({
                paymentMethod: 'UPI',
                amountPaid: 1250 // Exact reconciled total
            });

        assert.strictEqual(successfulPayment.status, 200, 'Reconciled payment must succeed (200)');
        assert.strictEqual(successfulPayment.body.data.status, 'Paid');
        assert.ok(successfulPayment.body.data.paymentDetails.transactionId.startsWith('ZENOPAY_SANDBOX_'));
        assert.strictEqual(successfulPayment.body.data.paymentDetails.amountPaid, 1250);

        // 4. Test PDF invoice generation
        const pdfRes = await request(app)
            .get(`/api/hospital/invoices/${invoice._id}/pdf`)
            .set('Authorization', `Bearer ${hospitalAdminToken}`);

        assert.strictEqual(pdfRes.status, 200);
        assert.strictEqual(pdfRes.headers['content-type'], 'application/pdf');
    });

    // -------------------------------------------------------------
    // ACCEPTANCE TEST 5: Audit Trail on Sensitive Record Access/Edits
    // -------------------------------------------------------------
    test('Acceptance Test 5: Sensitive record access or edits produce an audit entry', async () => {
        // Count audit logs before
        const beforeCount = await AuditLog.countDocuments({ patientId: testPatientId });

        // 1. Sensitive action: Read patient details
        const viewRes = await request(app)
            .get(`/api/reception/patients/${testPatientId}`)
            .set('Authorization', `Bearer ${receptionistToken}`);

        assert.strictEqual(viewRes.status, 200);

        // 2. Sensitive action: Update patient demographics
        const editRes = await request(app)
            .put(`/api/reception/patients/${testPatientId}`)
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                address: { street: '99 Audited Boulevard', city: 'Metropolis', state: 'CA', pincode: '560001' }
            });

        assert.strictEqual(editRes.status, 200);

        // 3. Verify that audit entries were recorded
        const afterCount = await AuditLog.countDocuments({ patientId: testPatientId });
        assert.ok(afterCount >= beforeCount + 2, 'Viewing and editing sensitive patient records must generate audit entries');

        // 4. Query audit logs endpoint
        const auditRes = await request(app)
            .get('/api/hospital/audit-logs')
            .set('Authorization', `Bearer ${hospitalAdminToken}`);

        assert.strictEqual(auditRes.status, 200);
        assert.ok(auditRes.body.data.length > 0);

        const actions = auditRes.body.data.map(l => l.action);
        assert.ok(actions.includes('PATIENT_VIEW') || actions.includes('PATIENT_UPDATE'), 'Audit trail must contain recorded actions');
    });

    after(async () => {
        await mongoose.connection.close();
    });
});

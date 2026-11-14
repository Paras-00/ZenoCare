const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/../.env' });

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zenocare';

const app = require('../server');
const request = require('supertest');

async function runFullAPIScreening() {
    console.log('====================================================');
    console.log('🩺 ZENOCARE COMPREHENSIVE API SCREENING SUITE');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    const assertEndpoint = (name, res, expectedStatus = 200) => {
        if (res.status === expectedStatus) {
            console.log(`  ✅ [${res.status}] ${name}`);
            passed++;
            return true;
        } else {
            console.error(`  ❌ [FAILED] ${name} -> Expected ${expectedStatus}, got ${res.status}`);
            console.error('     Response:', res.body || res.text?.substring(0, 100));
            failed++;
            return false;
        }
    };

    try {
        // 1. Super Admin Auth & Dashboard API with paras@gmail.com
        console.log('--- 1. Super Admin APIs (paras@gmail.com) ---');
        const adminLogin = await request(app)
            .post('/api/admin/login')
            .send({ email: 'paras@gmail.com', password: 'admin123' });
        assertEndpoint('POST /api/admin/login (paras@gmail.com)', adminLogin, 200);
        const adminToken = adminLogin.body.data?.token;

        const adminHospitals = await request(app)
            .get('/api/admin/hospitals')
            .set('Authorization', `Bearer ${adminToken}`);
        assertEndpoint('GET /api/admin/hospitals', adminHospitals, 200);

        const adminStats = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${adminToken}`);
        assertEndpoint('GET /api/admin/stats', adminStats, 200);

        // 2. Hospital Admin APIs
        console.log('\n--- 2. Hospital Admin APIs (hospital@zenocare.com) ---');
        const hospLogin = await request(app)
            .post('/api/hospital/login')
            .send({ email: 'hospital@zenocare.com', password: 'hospital123' });
        assertEndpoint('POST /api/hospital/login', hospLogin, 200);
        const hospitalToken = hospLogin.body.data?.token;
        const hospitalId = hospLogin.body.data?.hospital?._id || hospLogin.body.data?.hospital?.id;

        const hospStats = await request(app)
            .get('/api/hospital/stats')
            .set('Authorization', `Bearer ${hospitalToken}`);
        assertEndpoint('GET /api/hospital/stats', hospStats, 200);

        const hospStaff = await request(app)
            .get('/api/hospital/staff')
            .set('Authorization', `Bearer ${hospitalToken}`);
        assertEndpoint('GET /api/hospital/staff', hospStaff, 200);

        const hospDepts = await request(app)
            .get('/api/hospital/departments')
            .set('Authorization', `Bearer ${hospitalToken}`);
        assertEndpoint('GET /api/hospital/departments', hospDepts, 200);

        const hospInvoices = await request(app)
            .get('/api/hospital/invoices')
            .set('Authorization', `Bearer ${hospitalToken}`);
        assertEndpoint('GET /api/hospital/invoices', hospInvoices, 200);

        const hospAudit = await request(app)
            .get('/api/hospital/audit-logs')
            .set('Authorization', `Bearer ${hospitalToken}`);
        assertEndpoint('GET /api/hospital/audit-logs', hospAudit, 200);

        const hospReports = await request(app)
            .get('/api/hospital/reports/summary')
            .set('Authorization', `Bearer ${hospitalToken}`);
        assertEndpoint('GET /api/hospital/reports/summary', hospReports, 200);

        // 3. Clinician / Doctor APIs
        console.log('\n--- 3. Doctor APIs (dr.sarah@zenocare.com) ---');
        const docLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dr.sarah@zenocare.com', password: 'doctor123' });
        assertEndpoint('POST /api/auth/login (Doctor)', docLogin, 200);
        const docToken = docLogin.body.token;
        const doctorId = docLogin.body.user?.id;

        const docStats = await request(app)
            .get('/api/doctor/stats')
            .set('Authorization', `Bearer ${docToken}`);
        assertEndpoint('GET /api/doctor/stats', docStats, 200);

        const docAppts = await request(app)
            .get('/api/doctor/appointments')
            .set('Authorization', `Bearer ${docToken}`);
        assertEndpoint('GET /api/doctor/appointments', docAppts, 200);

        // 4. Receptionist APIs
        console.log('\n--- 4. Receptionist APIs (reception@zenocare.com) ---');
        const recLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'reception@zenocare.com', password: 'reception123' });
        assertEndpoint('POST /api/auth/login (Receptionist)', recLogin, 200);
        const recToken = recLogin.body.token;

        const recStats = await request(app)
            .get('/api/reception/stats')
            .set('Authorization', `Bearer ${recToken}`);
        assertEndpoint('GET /api/reception/stats', recStats, 200);

        const recDoctors = await request(app)
            .get('/api/reception/doctors')
            .set('Authorization', `Bearer ${recToken}`);
        assertEndpoint('GET /api/reception/doctors', recDoctors, 200);

        const recSlots = await request(app)
            .get(`/api/reception/doctors/${doctorId}/available-slots?date=2026-12-08`)
            .set('Authorization', `Bearer ${recToken}`);
        assertEndpoint('GET /api/reception/doctors/:id/available-slots', recSlots, 200);

        const recPatients = await request(app)
            .get('/api/reception/patients')
            .set('Authorization', `Bearer ${recToken}`);
        assertEndpoint('GET /api/reception/patients', recPatients, 200);

        const recAppointments = await request(app)
            .get('/api/reception/appointments')
            .set('Authorization', `Bearer ${recToken}`);
        assertEndpoint('GET /api/reception/appointments', recAppointments, 200);

        // 5. Billing Executive APIs
        console.log('\n--- 5. Billing APIs (billing@zenocare.com) ---');
        const billLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'billing@zenocare.com', password: 'billing123' });
        assertEndpoint('POST /api/auth/login (Billing)', billLogin, 200);
        const billToken = billLogin.body.token;

        const firstInvoiceId = hospInvoices.body.data?.[0]?._id;
        if (firstInvoiceId) {
            const invoicePdf = await request(app)
                .get(`/api/hospital/invoices/${firstInvoiceId}/pdf`)
                .set('Authorization', `Bearer ${billToken}`);
            assertEndpoint('GET /api/hospital/invoices/:id/pdf (PDFKit Stream)', invoicePdf, 200);
        }

        console.log('\n====================================================');
        console.log(`📊 SCREENING RESULTS: ${passed} Passed, ${failed} Failed`);
        console.log('====================================================\n');

        await mongoose.connection.close();
        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('Fatal screening error:', err);
        await mongoose.connection.close();
        process.exit(1);
    }
}

runFullAPIScreening();

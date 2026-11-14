const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const Admin = require('../models/Admin');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Staff = require('../models/Staff');
const Department = require('../models/Department');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const VisitRecord = require('../models/VisitRecord');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');

const seedDatabase = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zenocare';
        await mongoose.connect(mongoUri);
        console.log(`Connected to MongoDB for seeding: ${mongoUri}`);

        // Clean existing seed collections
        await Admin.deleteMany({});
        await Hospital.deleteMany({});
        await Doctor.deleteMany({});
        await Staff.deleteMany({});
        await Department.deleteMany({});
        await Patient.deleteMany({});
        await Appointment.deleteMany({});
        await VisitRecord.deleteMany({});
        await Invoice.deleteMany({});
        await AuditLog.deleteMany({});

        console.log('Cleared existing collections.');

        // 1. Super Admin
        const superAdmin = await Admin.create({
            name: 'Super Administrator',
            email: 'kenznajeeb@gmail.com',
            password: 'admin123',
            role: 'super_admin',
            phone: '9876543210',
            isActive: true
        });
        console.log('✓ Super Admin created: kenznajeeb@gmail.com / admin123');

        // 2. Hospital
        const hospital = await Hospital.create({
            name: 'Apex Memorial Hospital',
            registrationNumber: 'REG-APEX-2026-001',
            licenseNumber: 'LIC-MED-774910',
            email: 'hospital@zenocare.com',
            password: 'hospital123',
            phone: '9876543211',
            status: 'approved',
            type: 'Private',
            totalBeds: 150,
            specializations: ['Cardiology', 'Orthopedics', 'General Medicine', 'Pediatrics'],
            address: {
                street: '100 Healthcare Boulevard, Suite 400',
                city: 'Metropolis',
                state: 'California',
                pincode: '560001'
            },
            adminContact: {
                name: 'Dr. Arthur Vance',
                email: 'arthur.vance@apexhealth.com',
                phone: '9876543212'
            },
            description: 'Premier multi-specialty tertiary care healthcare hospital.'
        });
        console.log('✓ Hospital created: hospital@zenocare.com / hospital123');

        // 3. Departments
        const deptMed = await Department.create({
            hospitalId: hospital._id,
            name: 'General Medicine',
            code: 'MED',
            description: 'Primary care, diagnostic assessments, and internal medicine.',
            totalBeds: 50,
            availableBeds: 42
        });

        const deptCard = await Department.create({
            hospitalId: hospital._id,
            name: 'Cardiology',
            code: 'CARD',
            description: 'Comprehensive cardiovascular disease care and coronary interventions.',
            totalBeds: 40,
            availableBeds: 30
        });

        const deptOrtho = await Department.create({
            hospitalId: hospital._id,
            name: 'Orthopedics',
            code: 'ORTHO',
            description: 'Joint replacement, trauma, musculoskeletal pathology and sports medicine.',
            totalBeds: 35,
            availableBeds: 25
        });
        console.log('✓ Departments created: General Medicine, Cardiology, Orthopedics');

        // 4. Doctors with weekly working schedules
        const drSarah = await Doctor.create({
            hospitalId: hospital._id,
            firstName: 'Sarah',
            lastName: 'Jenkins',
            email: 'dr.sarah@zenocare.com',
            password: 'doctor123',
            phone: '9876500001',
            specialization: 'Cardiology',
            qualification: 'MD, DM (Cardiology), FACC',
            experience: 12,
            licenseNumber: 'MED-REG-44819',
            departmentId: deptCard._id,
            consultationFee: 600,
            consultationDuration: 30,
            schedule: [
                { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
                { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
                { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
                { day: 'Thursday', startTime: '09:00', endTime: '17:00', isAvailable: true },
                { day: 'Friday', startTime: '09:00', endTime: '17:00', isAvailable: true },
                { day: 'Saturday', startTime: '09:00', endTime: '13:00', isAvailable: true }
            ]
        });

        const drRajesh = await Doctor.create({
            hospitalId: hospital._id,
            firstName: 'Rajesh',
            lastName: 'Sharma',
            email: 'dr.rajesh@zenocare.com',
            password: 'doctor123',
            phone: '9876500002',
            specialization: 'Orthopedics',
            qualification: 'MS (Orthopedics), MCh',
            experience: 15,
            licenseNumber: 'MED-REG-55102',
            departmentId: deptOrtho._id,
            consultationFee: 550,
            consultationDuration: 30,
            schedule: [
                { day: 'Monday', startTime: '10:00', endTime: '16:00', isAvailable: true },
                { day: 'Tuesday', startTime: '10:00', endTime: '16:00', isAvailable: true },
                { day: 'Wednesday', startTime: '10:00', endTime: '16:00', isAvailable: true },
                { day: 'Thursday', startTime: '10:00', endTime: '16:00', isAvailable: true },
                { day: 'Friday', startTime: '10:00', endTime: '16:00', isAvailable: true }
            ]
        });

        const drPriya = await Doctor.create({
            hospitalId: hospital._id,
            firstName: 'Priya',
            lastName: 'Patel',
            email: 'dr.priya@zenocare.com',
            password: 'doctor123',
            phone: '9876500003',
            specialization: 'General Medicine',
            qualification: 'MBBS, MD (Medicine)',
            experience: 8,
            licenseNumber: 'MED-REG-66289',
            departmentId: deptMed._id,
            consultationFee: 450,
            consultationDuration: 30,
            schedule: [
                { day: 'Monday', startTime: '08:30', endTime: '16:30', isAvailable: true },
                { day: 'Tuesday', startTime: '08:30', endTime: '16:30', isAvailable: true },
                { day: 'Wednesday', startTime: '08:30', endTime: '16:30', isAvailable: true },
                { day: 'Thursday', startTime: '08:30', endTime: '16:30', isAvailable: true },
                { day: 'Friday', startTime: '08:30', endTime: '16:30', isAvailable: true }
            ]
        });

        // Set Head of Departments
        deptCard.headOfDepartment = drSarah._id;
        await deptCard.save();
        deptOrtho.headOfDepartment = drRajesh._id;
        await deptOrtho.save();
        deptMed.headOfDepartment = drPriya._id;
        await deptMed.save();
        console.log('✓ Doctors created: dr.sarah, dr.rajesh, dr.priya (password: doctor123)');

        // 5. Staff (Receptionist & Billing)
        const receptionist = await Staff.create({
            hospitalId: hospital._id,
            employeeId: 'EMP-REC-001',
            firstName: 'Alex',
            lastName: 'Rivera',
            email: 'reception@zenocare.com',
            password: 'reception123',
            phone: '9876500010',
            role: 'Receptionist',
            joiningDate: new Date(),
            departmentId: deptMed._id
        });

        const billingStaff = await Staff.create({
            hospitalId: hospital._id,
            employeeId: 'EMP-BIL-002',
            firstName: 'Bob',
            lastName: 'Miller',
            email: 'billing@zenocare.com',
            password: 'billing123',
            phone: '9876500011',
            role: 'Billing',
            joiningDate: new Date(),
            departmentId: deptMed._id
        });
        console.log('✓ Staff created: reception@zenocare.com (reception123), billing@zenocare.com (billing123)');

        // 6. Synthetic Patients
        const patient1 = await Patient.create({
            hospitalId: hospital._id,
            patientId: 'PID-2026-1001',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1982-05-14'),
            gender: 'Male',
            bloodGroup: 'A+',
            phone: '9811111111',
            email: 'john.doe@synthetic.com',
            address: { street: '12 Oak Lane', city: 'Metropolis', state: 'CA', pincode: '560001' },
            medicalHistory: [{ condition: 'Mild Hypertension', diagnosedDate: new Date('2023-01-15'), notes: 'Controlled with diet and lifestyle' }],
            allergies: ['Penicillin'],
            registeredBy: receptionist._id
        });

        const patient2 = await Patient.create({
            hospitalId: hospital._id,
            patientId: 'PID-2026-1002',
            firstName: 'Emily',
            lastName: 'Davis',
            dateOfBirth: new Date('1995-11-20'),
            gender: 'Female',
            bloodGroup: 'B+',
            phone: '9822222222',
            email: 'emily.davis@synthetic.com',
            address: { street: '45 Pine Ridge', city: 'Metropolis', state: 'CA', pincode: '560002' },
            medicalHistory: [{ condition: 'Childhood Asthma', diagnosedDate: new Date('2005-06-10'), notes: 'No recent exacerbations' }],
            allergies: ['Dust mites', 'Pollen'],
            registeredBy: receptionist._id
        });

        const patient3 = await Patient.create({
            hospitalId: hospital._id,
            patientId: 'PID-2026-1003',
            firstName: 'Carlos',
            lastName: 'Mendoza',
            dateOfBirth: new Date('1966-03-08'),
            gender: 'Male',
            bloodGroup: 'O+',
            phone: '9833333333',
            email: 'carlos.mendoza@synthetic.com',
            address: { street: '78 Maple Court', city: 'Metropolis', state: 'CA', pincode: '560003' },
            medicalHistory: [{ condition: 'Type 2 Diabetes Mellitus', diagnosedDate: new Date('2018-09-20'), notes: 'Under diet control' }],
            registeredBy: receptionist._id
        });
        console.log('✓ Synthetic Patients created: John Doe, Emily Davis, Carlos Mendoza');

        // 7. Appointments & Clinical Visit Record
        const todayStr = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        // Appointment 1: Completed consultation for John Doe with Dr. Sarah Jenkins
        const apt1Slot = `${drSarah._id.toString()}_${todayStr}_09:30`;
        const apt1 = await Appointment.create({
            hospitalId: hospital._id,
            patientId: patient1._id,
            doctorId: drSarah._id,
            departmentId: deptCard._id,
            appointmentDate: new Date(`${todayStr}T00:00:00.000Z`),
            appointmentTime: '09:30',
            slotKey: apt1Slot,
            activeSlotKey: apt1Slot,
            reason: 'Routine cardiac review and BP evaluation',
            consultationFee: 600,
            status: 'Completed',
            isPaid: true,
            createdBy: receptionist._id
        });

        // Visit Record for Appointment 1
        const visit1 = await VisitRecord.create({
            hospitalId: hospital._id,
            appointmentId: apt1._id,
            patientId: patient1._id,
            doctorId: drSarah._id,
            encounterDate: new Date(),
            visitType: 'Consultation',
            chiefComplaint: 'Mild exertional palpitations and regular blood pressure monitoring',
            vitals: {
                bloodPressure: '124/82 mmHg',
                heartRate: 72,
                temperature: '98.4 F',
                respiratoryRate: 16,
                spO2: 99,
                weight: 76,
                height: 178
            },
            clinicianNotes: {
                subjective: 'Patient reports feeling well overall. Occasional mild fatigue after long shifts. No chest pain or syncope.',
                objective: 'S1, S2 regular without murmurs. Chest clear bilaterally. Peripheral pulses palpable.',
                assessment: 'Stage-1 essential hypertension, currently well-controlled on lifestyle modifications.',
                plan: 'Maintain low-sodium diet, regular aerobic exercise 30 min daily. Continue baseline medication.'
            },
            prescriptions: [
                {
                    medicine: 'Amlodipine Besylate',
                    dosage: '5 mg',
                    frequency: '1-0-0 (Once daily morning)',
                    duration: '30 days',
                    instructions: 'Take after breakfast'
                },
                {
                    medicine: 'Coenzyme Q10',
                    dosage: '100 mg',
                    frequency: '0-1-0 (After lunch)',
                    duration: '30 days',
                    instructions: 'Dietary supplement'
                }
            ],
            diagnosticReports: [
                {
                    testName: 'Standard 12-Lead Electrocardiogram (ECG)',
                    category: 'Cardiology Diagnostics',
                    status: 'Completed',
                    resultSummary: 'Normal sinus rhythm at 72 bpm. PR interval 160ms, QTc 410ms. No ST-T wave abnormalities.',
                    reportedAt: new Date(),
                    clinicianNotes: 'ECG within normal clinical parameters.'
                },
                {
                    testName: 'Comprehensive Lipid Profile',
                    category: 'Clinical Biochemistry',
                    status: 'Completed',
                    resultSummary: 'Total Cholesterol: 182 mg/dL, HDL: 48 mg/dL, LDL: 104 mg/dL, Triglycerides: 150 mg/dL.',
                    reportedAt: new Date(),
                    clinicianNotes: 'Lipid parameters acceptable.'
                }
            ],
            followUpDate: new Date(Date.now() + 30 * 86400000)
        });

        apt1.visitRecordId = visit1._id;
        apt1.diagnosis = visit1.clinicianNotes.assessment;
        apt1.prescription = visit1.prescriptions;
        await apt1.save();

        // Appointment 2: Scheduled for Emily Davis with Dr. Priya Patel tomorrow at 10:00
        const apt2Slot = `${drPriya._id.toString()}_${tomorrowStr}_10:00`;
        const apt2 = await Appointment.create({
            hospitalId: hospital._id,
            patientId: patient2._id,
            doctorId: drPriya._id,
            departmentId: deptMed._id,
            appointmentDate: new Date(`${tomorrowStr}T00:00:00.000Z`),
            appointmentTime: '10:00',
            slotKey: apt2Slot,
            activeSlotKey: apt2Slot,
            reason: 'Seasonal allergy assessment and general wellness checkup',
            consultationFee: 450,
            status: 'Scheduled',
            isPaid: false,
            createdBy: receptionist._id
        });

        // Appointment 3: Scheduled for Carlos Mendoza with Dr. Rajesh Sharma tomorrow at 11:00
        const apt3Slot = `${drRajesh._id.toString()}_${tomorrowStr}_11:00`;
        const apt3 = await Appointment.create({
            hospitalId: hospital._id,
            patientId: patient3._id,
            doctorId: drRajesh._id,
            departmentId: deptOrtho._id,
            appointmentDate: new Date(`${tomorrowStr}T00:00:00.000Z`),
            appointmentTime: '11:00',
            slotKey: apt3Slot,
            activeSlotKey: apt3Slot,
            reason: 'Persistent bilateral knee pain aggravated on stair climbing',
            consultationFee: 550,
            status: 'Confirmed',
            isPaid: false,
            createdBy: receptionist._id
        });
        console.log('✓ Appointments & Clinical Visit records created.');

        // 8. Itemized Invoices
        // Invoice 1: Paid invoice for John Doe
        const inv1 = await Invoice.create({
            hospitalId: hospital._id,
            invoiceNumber: 'INV-20261114-10001',
            patientName: 'John Doe',
            patientId: patient1._id,
            appointmentId: apt1._id,
            items: [
                { description: 'Cardiology Specialist Consultation', quantity: 1, unitPrice: 600, cost: 600 },
                { description: 'Standard 12-Lead ECG Diagnostics', quantity: 1, unitPrice: 400, cost: 400 }
            ],
            subtotal: 1000,
            tax: 0,
            discount: 0,
            totalAmount: 1000,
            status: 'Paid',
            paymentDetails: {
                method: 'Card',
                transactionId: 'ZENOPAY_SANDBOX_1700000000_9482',
                paidAt: new Date(),
                gateway: 'ZenoCare Sandbox Gateway',
                amountPaid: 1000
            },
            date: new Date()
        });
        apt1.invoiceId = inv1._id;
        await apt1.save();

        // Invoice 2: Pending invoice for Carlos Mendoza
        const inv2 = await Invoice.create({
            hospitalId: hospital._id,
            invoiceNumber: 'INV-20261114-10002',
            patientName: 'Carlos Mendoza',
            patientId: patient3._id,
            appointmentId: apt3._id,
            items: [
                { description: 'Orthopedic Specialty Evaluation', quantity: 1, unitPrice: 550, cost: 550 },
                { description: 'High-Resolution Digital X-Ray (Bilateral Knee AP/Lat)', quantity: 1, unitPrice: 750, cost: 750 }
            ],
            subtotal: 1300,
            tax: 0,
            discount: 50,
            totalAmount: 1250,
            status: 'Pending',
            date: new Date()
        });
        console.log('✓ Invoices created (1 Paid with sandbox settlement, 1 Pending).');

        // 9. Audit Logs
        await AuditLog.create([
            {
                hospitalId: hospital._id,
                userId: receptionist._id.toString(),
                userName: 'Alex Rivera',
                userRole: 'receptionist',
                action: 'PATIENT_CREATE',
                resourceType: 'Patient',
                resourceId: patient1._id,
                patientId: patient1._id,
                details: { patientId: patient1.patientId, name: 'John Doe' },
                timestamp: new Date(Date.now() - 3600000)
            },
            {
                hospitalId: hospital._id,
                userId: receptionist._id.toString(),
                userName: 'Alex Rivera',
                userRole: 'receptionist',
                action: 'APPOINTMENT_BOOK',
                resourceType: 'Appointment',
                resourceId: apt1._id,
                patientId: patient1._id,
                details: { slotKey: apt1Slot, doctor: 'Dr. Sarah Jenkins' },
                timestamp: new Date(Date.now() - 3000000)
            },
            {
                hospitalId: hospital._id,
                userId: drSarah._id.toString(),
                userName: 'Dr. Sarah Jenkins',
                userRole: 'doctor',
                action: 'VISIT_RECORD_CREATE',
                resourceType: 'VisitRecord',
                resourceId: visit1._id,
                patientId: patient1._id,
                details: { chiefComplaint: visit1.chiefComplaint, prescriptionsCount: 2 },
                timestamp: new Date(Date.now() - 1800000)
            },
            {
                hospitalId: hospital._id,
                userId: billingStaff._id.toString(),
                userName: 'Bob Miller',
                userRole: 'billing',
                action: 'PAYMENT_PROCESSED',
                resourceType: 'Invoice',
                resourceId: inv1._id,
                patientId: patient1._id,
                details: { invoiceNumber: inv1.invoiceNumber, amountPaid: 1000, transactionId: inv1.paymentDetails.transactionId },
                timestamp: new Date(Date.now() - 900000)
            }
        ]);
        console.log('✓ Audit logs generated.');

        console.log('\n========================================');
        console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
        console.log('Demo Credentials for Assessment Review:');
        console.log('----------------------------------------');
        console.log('1. Super Admin:  kenznajeeb@gmail.com / admin123');
        console.log('2. Hospital Admin: hospital@zenocare.com / hospital123');
        console.log('3. Doctor:       dr.sarah@zenocare.com / doctor123');
        console.log('4. Receptionist: reception@zenocare.com / reception123');
        console.log('5. Billing:      billing@zenocare.com / billing123');
        console.log('========================================\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedDatabase();

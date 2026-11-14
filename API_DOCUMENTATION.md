# ZenoCare Hospital Management System — API Documentation

**Base URL**: `http://localhost:5000/api`  
**Authentication**: Bearer JWT (`Authorization: Bearer <token>`)

---

## 1. Authentication & Identity (`/auth`)

### 1.1 Unified Login
- **Endpoint**: `POST /auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "dr.sarah@zenocare.com",
    "password": "doctor123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "67364b6e...",
      "name": "Sarah Jenkins",
      "email": "dr.sarah@zenocare.com",
      "role": "doctor",
      "userType": "hospital_staff",
      "hospitalId": "67364b6d..."
    }
  }
  ```

---

## 2. Front-Desk Reception & Scheduling (`/reception`)

### 2.1 Get Verified Available Doctor Slots
- **Endpoint**: `GET /reception/doctors/:id/available-slots?date=YYYY-MM-DD`
- **Access**: Private (`receptionist`, `hospital_admin`, `doctor`)
- **Query Parameters**:
  - `date`: Target consultation date in `YYYY-MM-DD` format.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "date": "2026-12-01",
    "dayOfWeek": "Tuesday",
    "isAvailable": true,
    "doctor": {
      "id": "67364b6e...",
      "name": "Dr. Sarah Jenkins",
      "specialization": "Cardiology",
      "consultationFee": 600,
      "duration": 30
    },
    "allSlots": ["09:00", "09:30", "10:00", "10:30", "11:00", ...],
    "bookedSlots": ["09:30"],
    "availableSlots": ["09:00", "10:00", "10:30", "11:00", ...]
  }
  ```

### 2.2 Book Appointment (with Concurrency Conflict Protection)
- **Endpoint**: `POST /reception/appointments`
- **Access**: Private (`receptionist`, `hospital_admin`)
- **Request Body**:
  ```json
  {
    "patientId": "67364b6f...",
    "doctorId": "67364b6e...",
    "date": "2026-12-01",
    "time": "10:00",
    "reason": "Chest tightness and palpitations",
    "appointmentType": "Consultation",
    "consultationFee": 600
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Appointment booked successfully",
    "data": {
      "_id": "67364b70...",
      "hospitalId": "67364b6d...",
      "patientId": "67364b6f...",
      "doctorId": "67364b6e...",
      "appointmentDate": "2026-12-01T00:00:00.000Z",
      "appointmentTime": "10:00",
      "slotKey": "67364b6e..._2026-12-01_10:00",
      "status": "Scheduled"
    }
  }
  ```
- **Conflict Error (409 Conflict)**:
  ```json
  {
    "success": false,
    "message": "Conflicting appointment: This doctor slot was just booked by another concurrent request."
  }
  ```

### 2.3 Reschedule Appointment
- **Endpoint**: `PUT /reception/appointments/:id/reschedule`
- **Access**: Private (`receptionist`, `hospital_admin`, `doctor`)
- **Request Body**:
  ```json
  {
    "newDate": "2026-12-03",
    "newTime": "14:00",
    "reason": "Patient requested evening slot"
  }
  ```

### 2.4 Cancel Appointment
- **Endpoint**: `PUT /reception/appointments/:id/cancel`
- **Access**: Private (`receptionist`, `hospital_admin`, `doctor`)
- **Request Body**:
  ```json
  {
    "reason": "Patient rescheduled at external clinic"
  }
  ```

---

## 3. Clinical Encounters & Doctor Records (`/doctor`)

### 3.1 Create or Update Clinical Visit Record
- **Endpoint**: `POST /doctor/appointments/:id/visit`
- **Access**: Private (`doctor` only — server-side RBAC enforced)
- **Request Body**:
  ```json
  {
    "visitType": "Consultation",
    "chiefComplaint": "Exertional chest tightness",
    "vitals": {
      "bloodPressure": "124/82 mmHg",
      "heartRate": 72,
      "temperature": "98.4 F",
      "spO2": 99,
      "weight": 76
    },
    "clinicianNotes": {
      "subjective": "Patient reports mild shortness of breath upon exertion.",
      "objective": "Normal S1/S2 heart sounds, lungs clear bilaterally.",
      "assessment": "Stage-1 essential hypertension.",
      "plan": "Low sodium diet, continue beta-blocker."
    },
    "prescriptions": [
      {
        "medicine": "Amlodipine Besylate",
        "dosage": "5 mg",
        "frequency": "1-0-0",
        "duration": "30 days",
        "instructions": "Take in morning after food"
      }
    ],
    "diagnosticReports": [
      {
        "testName": "12-Lead Electrocardiogram (ECG)",
        "category": "Cardiology",
        "status": "Completed",
        "resultSummary": "Normal sinus rhythm at 72 bpm. No ST-T elevation."
      }
    ]
  }
  ```

### 3.2 Get Visit Record
- **Endpoint**: `GET /doctor/appointments/:id/visit`
- **Access**: Private (`doctor`, `hospital_admin`)

---

## 4. Itemized Invoicing & Simulated Sandbox Payment (`/hospital`)

### 4.1 Create Itemized Invoice (with Line Items Reconciliation)
- **Endpoint**: `POST /hospital/invoices`
- **Access**: Private (`hospital_admin`, `billing`, `receptionist`)
- **Request Body**:
  ```json
  {
    "patientName": "John Doe",
    "patientId": "67364b6f...",
    "appointmentId": "67364b70...",
    "items": [
      { "description": "Cardiology Consultation", "quantity": 1, "unitPrice": 600, "cost": 600 },
      { "description": "12-Lead ECG", "quantity": 1, "unitPrice": 400, "cost": 400 }
    ],
    "tax": 50,
    "discount": 50
  }
  ```
- **Reconciliation Formula**:
  $$\text{Subtotal} = 600 + 400 = 1000$$
  $$\text{Total} = 1000 + 50 - 50 = 1000$$

### 4.2 Process Simulated Sandbox Payment
- **Endpoint**: `POST /hospital/invoices/:id/sandbox-pay`
- **Access**: Private (`hospital_admin`, `billing`, `receptionist`)
- **Request Body**:
  ```json
  {
    "paymentMethod": "Card",
    "amountPaid": 1000
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Sandbox payment successfully verified, reconciled and settled",
    "data": {
      "invoiceNumber": "INV-20261114-10001",
      "status": "Paid",
      "paymentDetails": {
        "method": "Card",
        "transactionId": "ZENOPAY_SANDBOX_1731600000000_1234",
        "gateway": "ZenoCare Sandbox Gateway",
        "amountPaid": 1000,
        "paidAt": "2026-11-14T18:00:00.000Z"
      }
    }
  }
  ```
- **Reconciliation Mismatch Error (422 Unprocessable Entity)**:
  ```json
  {
    "success": false,
    "message": "Payment reconciliation failed: Payment amount (₹999) does not match invoice total amount (₹1000)."
  }
  ```

### 4.3 Download Itemized PDF Invoice Receipt
- **Endpoint**: `GET /hospital/invoices/:id/pdf`
- **Access**: Private (`hospital_admin`, `billing`, `receptionist`, `doctor`)
- **Response**: `application/pdf` binary stream.

---

## 5. Security & Compliance Audit Trail (`/hospital`)

### 5.1 Query Audit Logs
- **Endpoint**: `GET /hospital/audit-logs?action=PATIENT_VIEW&userRole=receptionist&page=1&limit=50`
- **Access**: Private (`hospital_admin`, `super_admin`)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 1,
    "total": 42,
    "page": 1,
    "pages": 1,
    "data": [
      {
        "_id": "67364b71...",
        "userId": "67364b6e...",
        "userName": "Alex Rivera",
        "userRole": "receptionist",
        "action": "PATIENT_VIEW",
        "resourceType": "Patient",
        "resourceId": "67364b6f...",
        "details": { "patientId": "PID-2026-1001", "name": "John Doe" },
        "ipAddress": "127.0.0.1",
        "timestamp": "2026-11-14T17:45:00.000Z"
      }
    ]
  }
  ```

### 5.2 Operations & Financial Analytics Summary
- **Endpoint**: `GET /hospital/reports/summary`
- **Access**: Private (`hospital_admin`, `super_admin`)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "appointments": {
        "byStatus": { "Scheduled": 5, "Completed": 12, "Cancelled": 1 },
        "byDoctor": [
          { "doctorName": "Dr. Sarah Jenkins", "specialization": "Cardiology", "count": 8 }
        ]
      },
      "billing": {
        "totalInvoices": 18,
        "totalInvoiced": 24500,
        "totalCollected": 19500,
        "pendingAmount": 5000,
        "collectionRate": 79.6,
        "paymentMethodsBreakdown": { "Card": 12000, "UPI": 7500 }
      },
      "demographics": {
        "totalPatients": 35
      }
    }
  }
  ```

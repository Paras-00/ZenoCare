# TECHNICAL REPORT: ZenoCare Hospital Management System

**Author / Candidate:** Kenz Najeeb  
**Internship Role:** Full-Stack Web Development  
**Assessment Domain:** Hospital Management System  
**Submission Artifact:** Advanced Technical Architecture & Engineering Decisions Report  

---

## 1. Executive Summary & Problem Scope

Hospital operations demand high reliability, strict role separation, data integrity under concurrent scheduling requests, clinical accuracy without automated diagnosis, and auditable financial reconciliation.

The **ZenoCare Hospital Management System** was engineered to address these challenges as a unified platform serving four primary operational roles:
1. **Hospital Administration**: Organizational setup, staff credentialing, department configuration, compliance audit log inspection, and operational analytics.
2. **Clinicians (Doctors)**: Management of doctor daily schedule, conducting clinical encounters, logging objective vitals and notes, prescribing medications, and ordering diagnostic tests.
3. **Front-Desk Receptionists**: Synthetic patient registration, searching real-time verified doctor slot availability, and booking, rescheduling, or cancelling appointments.
4. **Billing & Accounting**: Itemized invoice creation, line items mathematical reconciliation, simulated sandbox payment processing, and PDF receipt distribution.

---

## 2. Architecture & Design Rationale

### 2.1 Why a Modular Monolith?
Per Section 2 of the assessment brief, a **modular monolith** was selected over microservices. In hospital operations, patient registration, appointment scheduling, clinical encounters, and billing are tightly coupled business processes that benefit from immediate consistency and atomic transactions:
- **Zero Network Latency Overhead**: Internal module communication occurs in-process rather than through fragile HTTP/RPC meshes.
- **Data Integrity & Atomic Operations**: Shared database connections allow compound index enforcement, atomic lookups, and transactional data guarantees without distributed two-phase commit overhead.
- **Maintainability & Deployment Simplicity**: The entire application packages into a single backend service and a single frontend single-page application (SPA).

### 2.2 System Component Architecture

```
┌────────────────────────────────────────────────────────┐
│             React 18 Single Page Application           │
│    (Role-Gated Dashboards: Admin, Doctor, Reception)   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / REST (JSON + JWT)
┌──────────────────────────▼─────────────────────────────┐
│                 Express.js Application Layer            │
│  ┌───────────────────────┬──────────────────────────┐  │
│  │ JWT Authentication    │ Role Authorization (RBAC)│  │
│  ├───────────────────────┼──────────────────────────┤  │
│  │ Audit Logger (Audit)  │ Rate Limiter & Sanitize  │  │
│  └───────────────────────┴──────────────────────────┘  │
│  ┌───────────────────────┬──────────────────────────┐  │
│  │ Doctor Slot Engine    │ Concurrency Lock Guard   │  │
│  ├───────────────────────┼──────────────────────────┤  │
│  │ Visit Record Module   │ Invoice Reconciliation   │  │
│  └───────────────────────┴──────────────────────────┘  │
└──────────────────────────┬─────────────────────────────┘
                           │ Mongoose ODM
┌──────────────────────────▼─────────────────────────────┐
│                   MongoDB Persistence Tier              │
│   (Sparse Unique Slot Keys, Compound Indexes, Logs)    │
└────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Data Modeling

### 3.1 Entities and Relationships
- **Hospital**: Tenant boundary establishing data isolation across all operational records.
- **Department**: Clinical units (e.g., Cardiology, Orthopedics, General Medicine) housing specific clinicians and bed capacities.
- **Doctor & Staff**: Distinct credentials with specialized role scopes and doctor working schedule definitions.
- **Patient**: Comprehensive synthetic patient profile storing demographics, medical history, blood group, and emergency contacts.
- **Appointment**: Bridge between patient, clinician, date, and time slot.
- **VisitRecord**: Rich clinical encounter documentation containing vitals, subjective/objective clinician observations, prescriptions, and diagnostic test tracking.
- **Invoice**: Itemized financial document reconciled with line items and sandbox payment metadata.
- **AuditLog**: Immutable event log recording sensitive reads and modifications.

### 3.2 Concurrency & Double-Booking Prevention Engine

#### The Problem:
In high-throughput hospital booking environments, two receptionists or patients might simultaneously attempt to book Dr. Smith at 10:00 AM on 2026-12-01. If the server only performs an application-level `findOne()` followed by `create()`, a race condition occurs between the check and the write (Time-of-Check to Time-of-Use / TOCTOU vulnerability).

#### The Engineering Solution:
1. Every appointment computes a deterministic `slotKey`:  
   $$\text{slotKey} = \text{doctorId} + \text{"\_"} + \text{YYYY-MM-DD} + \text{"\_"} + \text{HH:mm}$$
2. An active booking carries an `activeSlotKey: slotKey`.
3. A **Sparse Unique Index** is declared on `activeSlotKey`:
   ```javascript
   appointmentSchema.index({ activeSlotKey: 1 }, { unique: true, sparse: true });
   ```
4. **Behavior on Simultaneous Collisions**:
   - The first request to commit succeeds and inserts the document.
   - The second concurrent request is rejected by MongoDB's storage engine with an atomic `E11000 duplicate key error`.
   - The controller catches code `11000` and immediately responds with **HTTP 409 Conflict** (`"Conflicting appointment: This doctor slot is already booked."`).
5. **Behavior on Reschedule**:
   - Re-validates the target slot and updates `activeSlotKey` to the new slot.
6. **Behavior on Cancellation**:
   - The appointment sets `status = 'Cancelled'` and unsets `activeSlotKey`.
   - Because the index is sparse, removing `activeSlotKey` frees the slot for subsequent bookings while preserving the historical record.

---

## 4. Role-Based Access Control (RBAC) Security Model

### 4.1 Strict Server-Side Enforcement
Client-side UI gating (e.g., hiding a button with `hasRole(...)`) is strictly treated as a UX convenience, never a security boundary. The backend enforces authentication and authorization on every route:

| API Route / Resource | Receptionist | Clinician (Doctor) | Hospital Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|
| `POST /api/reception/patients` | ✅ Read/Write | ❌ Read Only | ✅ Read/Write | ❌ Read Only |
| `POST /api/reception/appointments` | ✅ Book/Resched | ❌ View Only | ✅ Book/Resched | ❌ View Only |
| `POST /api/doctor/appointments/:id/visit` | ❌ **403 Forbidden** | ✅ **Author Only** | ❌ **403 Forbidden** | ❌ **403 Forbidden** |
| `POST /api/hospital/invoices/:id/sandbox-pay` | ✅ Process Pay | ❌ View Only | ✅ Process Pay | ❌ View Only |
| `GET /api/hospital/audit-logs` | ❌ **403 Forbidden** | ❌ **403 Forbidden** | ✅ Full Audit | ✅ Full Audit |
| `DELETE /api/hospital/staff/:id` | ❌ **403 Forbidden** | ❌ **403 Forbidden** | ✅ Authorize | ✅ Authorize |

Any attempt by an unauthorized role (e.g., a receptionist attempting to write clinical visit diagnoses or delete staff) immediately returns **HTTP 403 Forbidden**.

---

## 5. Clinical Encounter & Visit Record Design

### 5.1 No Automated Diagnosis Compliance
Section 1 of the assessment specifies: *"Maintain encounter metadata and clinician-entered notes, prescription records and diagnostic-report metadata. Do not implement automated diagnosis."*

The clinical encounter system adheres strictly to this requirement:
- **No Algorithm-Generated Diagnoses**: The system provides structured clinical input forms reflecting standard medical practice (SOAP format: Subjective, Objective, Assessment, Plan).
- **Clinician Accountability**: Assessment text and plan are clinician-entered text fields authored directly by the attending physician.
- **Diagnostic Report Tracking**: Diagnostic orders (e.g., ECG, CBC, X-Ray) track lifecycle states (`Ordered` $\rightarrow$ `Sample Collected` $\rightarrow$ `In Progress` $\rightarrow$ `Completed`) along with laboratory result summaries and clinician review notes.

---

## 6. Financial Invoicing & Sandbox Payment Flow

### 6.1 Mathematical Line Item Reconciliation
An invoice is considered valid if and only if:
$$\text{Subtotal} = \sum_{i=1}^{n} (\text{quantity}_i \times \text{unitPrice}_i)$$
$$\text{Total Amount} = \text{Subtotal} + \text{Tax} - \text{Discount}$$

- **Server-Side Verification**: The controller recalculates `subtotal` and `totalAmount` server-side from line items.
- **Payment Reconciliation**: When submitting a sandbox payment, the server validates:
  $$|\text{amountPaid} - \text{invoice.totalAmount}| = 0$$
  If mismatched, the server rejects the payment with **HTTP 422 Unprocessable Entity**.

### 6.2 Simulated Sandbox Gateway Flow
1. Invoice status starts as `Pending`.
2. User triggers simulated payment (Card / UPI / NetBanking / Cash).
3. The server generates a unique transaction reference:
   $$\text{TXN} = \text{"ZENOPAY\_SANDBOX\_"} + \text{timestamp} + \text{"\_"} + \text{random}$$
4. Status transitions to `Paid`.
5. The linked appointment is marked `isPaid = true`.
6. An itemized PDF invoice is generated on-demand using PDFKit with hospital branding, breakdown tables, and sandbox payment credentials.

---

## 7. Audit Logging & Regulatory Compliance

### 7.1 Sensitive Health Information Tracking
Section 3 Acceptance Test 5 states: *"Sensitive record access or edits produce an audit entry."*

Whenever a user views or edits sensitive records, an asynchronous audit logger writes an immutable record to the `auditlogs` collection:
- **Tracked Actions**:
  - `PATIENT_VIEW`: Triggered when patient details or medical histories are viewed.
  - `PATIENT_CREATE`, `PATIENT_UPDATE`, `PATIENT_DELETE`: Demographics mutations.
  - `APPOINTMENT_BOOK`, `APPOINTMENT_RESCHEDULE`, `APPOINTMENT_CANCEL`: Booking lifecycle.
  - `VISIT_RECORD_CREATE`: Clinical notes and diagnostic entries.
  - `PAYMENT_PROCESSED`: Financial settlement through sandbox gateway.
- **Audit Attributes Captured**:
  $$\{ \text{hospitalId}, \text{userId}, \text{userName}, \text{userRole}, \text{action}, \text{resourceType}, \text{resourceId}, \text{details}, \text{ipAddress}, \text{timestamp} \}$$

Administrators can review and filter these logs in real-time through the dedicated **Audit Trail** dashboard view.

---

## 8. Automated Test Suite & Acceptance Evidence

The automated test suite (`backend/tests/acceptance.test.js`) executes directly via Node's native test runner (`node --test`) and Supertest:

```
> zenocare-backend@1.0.0 test
> node --test tests/acceptance.test.js

✅ MongoDB Connected: 127.0.0.1
📊 Database: zenocare
▶ ZenoCare Hospital Management System - Core Acceptance Tests
  ✔ Acceptance Test 1: Search available doctor slots and book a patient into a verified slot (51.0ms)
  ✔ Acceptance Test 2: Conflicting appointments for the same doctor/time are prevented, including concurrent attempts (64.5ms)
  ✔ Acceptance Test 3: Only authorized roles can read or update relevant patient/visit information (RBAC) (54.8ms)
  ✔ Acceptance Test 4: An invoice reconciles with its line items and payment status (73.2ms)
  ✔ Acceptance Test 5: Sensitive record access or edits produce an audit entry (37.0ms)
✔ ZenoCare Hospital Management System - Core Acceptance Tests (656.2ms)
ℹ tests 5
ℹ suites 1
ℹ pass 5
ℹ fail 0
```

---

## 9. Assumptions & Known Limitations

1. **Synthetic Data**: In compliance with medical privacy standards (HIPAA/GDPR), all seeded patient profiles, phone numbers, and clinical histories are completely synthetic.
2. **Payment Gateway**: Live merchant accounts (e.g., Stripe live keys) are omitted in favor of the simulated sandbox payment gateway per instructions.
3. **Email Delivery**: SMTP email triggers are mocked in local development environments.

---

## 10. Conclusion

The ZenoCare platform successfully implements the full operational scope of a modern Hospital Management System. It rigorously enforces server-side access control, prevents appointment double bookings under high concurrency, documents clinical encounters responsibly without automated diagnosis, reconciles itemized billing mathematically, and maintains an immutable audit trail.

<div align="center">
  <h1>🦅 EagleNet Logistics Core API</h1>
  <p><strong>Enterprise Parallel Orchestration & Internal Logistics Engine</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Node.js-Express%205-green?style=for-the-badge&logo=node.js" alt="Node.js" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/PostgreSQL-TypeORM-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Socket.io-Real--Time-black?style=for-the-badge&logo=socket.io" alt="Socket.io" />
  </p>
</div>

---

## 📖 Overview

EagleNet is a mission-critical, enterprise-grade backend API designed exclusively for internal logistics management. It handles high-concurrency freight operations, document verification, customs clearance, financial orchestration, and immutable auditing. 

The core philosophy of EagleNet is **Parallel Orchestration** — meaning shipments are not locked to a single department. Instead, multiple departments (like Warehouse, Customs, and Finance) can collaborate on a shipment simultaneously, drastically reducing turnaround times.

---

## 📡 Standard API Envelope

Every API response, successful or otherwise, follows a strict, standardized JSON envelope structure defined by the internal `responseStandardizer` middleware.

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... },
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  },
  "timestamp": "2026-04-22T07:15:00.000Z",
  "requestId": "6be3da25-9c16-4c4e-8cc2-234dfa511974"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Access Denied: Insufficient permissions.",
  "errorCode": "FORBIDDEN"
}
```

---

## ⚙️ Core Workflows & API Specifications

EagleNet is broken down into comprehensive modular systems. Below are the major workflows and exact JSON payloads they process.

### 1. 🔐 Identity & Authentication (Auth Workflow)
EagleNet utilizes a JWT-based stateless authentication flow that issues long-lived refresh tokens.

**Login Request:**
```http
POST /api/auth/login
```
```json
{
  "email": "staff@eaglenet.com",
  "password": "SecurePassword123"
}
```

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5c... (Access Token)",
    "refreshToken": "a7b8c... (Refresh Token)",
    "user": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "staff@eaglenet.com",
      "role": "STAFF",
      "isActive": true
    }
  },
  "timestamp": "2026-04-22T08:00:00Z",
  "requestId": "uuid"
}
```

**Register Request (New Account):**
```http
POST /api/auth/register
```
```json
{
  "firstName": "Adeyemo",
  "lastName": "Ayomide",
  "email": "adxe@example.com",
  "password": "Password123"
}
```

**Staff Dashboard:**
```http
GET /api/users/me/dashboard
```
**Success Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "firstName": "Adeyemo", "role": "STAFF" },
    "assignedShipments": 5,
    "totalProcessed": 450000,
    "recentMessages": [ { "id": "msg-1", "content": "Update on EGL-001" } ]
  }
}
```

**Staff Provisioning (SuperAdmin Only):**
```http
POST /api/users/staff
```
```json
{
  "firstName": "Bolanle",
  "lastName": "Finance",
  "email": "finance.ops@eaglenet.com",
  "phoneNumber": "+2349000000000",
  "departmentId": "uuid-payment-dept",
  "roleId": "uuid-payment-officer"
}
```
**Response:** Returns a `tempPassword` for initial login.

**Update Notification Preferences:**
```http
PATCH /api/users/me/notifications/preferences
```
```json
{
  "email": true,
  "push": false,
  "statusUpdates": true,
  "financialAlerts": true
}
```

**Explanations:**
- **Auth Flow:** Stateless JWT authentication. Access tokens are used in the `Authorization: Bearer <token>` header. Refresh tokens are stored in the DB to manage long-lived sessions.
- **Dashboard:** Returns a summary of current tasks, unread messages, and personal stats for the authenticated staff member.
- **Preferences:** Allows toggling email, push, and in-app notifications for specific events (e.g., status changes).

### 2. 🚢 Shipment & Logistics Orchestration
The primary lifecycle of freight management. Shipments are created and immediately assigned a tracking number.

**Create Shipment Request:**
```http
POST /api/shipments
```
```json
{
  "shipmentName": "Industrial Pump Export",
  "type": "export",
  "clientName": "Joel Barnabas",
  "clientEmail": "joelbarnabas589@gmail.com",
  "clientPhone": "+2348012345678",
  "pickupAddress": "10 Broad Street",
  "pickupCity": "Lagos",
  "deliveryAddress": "45 Airport Road",
  "destinationCity": "Abuja",
  "weightKg": 25.5,
  "description": "Critical spare parts for oil rig",
  "departmentId": "f960435a-40a4-4f74-815b-db069e877191"
}
```

**Create Shipment Response:**
```json
{
  "success": true,
  "message": "Shipment created successfully.",
  "data": {
    "id": "uuid-of-shipment",
    "trackingNumber": "EGL-EXP-240001",
    "status": "pending",
    "expectedDeliveryDate": "2026-05-05"
  },
  "timestamp": "2026-04-22T08:05:00Z",
  "requestId": "uuid"
}
```

**Additional Logistics Workflows:**

**Activity History Ledger:**
```http
GET /api/shipments/:id/history
```
**Success Response:**
```json
{
  "success": true,
  "data": [
    { "action": "created", "timestamp": "2026-04-22T08:00:00Z", "actor": "Jane Admin" },
    { "action": "document_uploaded", "details": { "fileName": "Waybill.pdf" } }
  ]
}
```

**Bulk Import (Admin):**
`POST /api/shipments/bulk-import` (Multipart with `file` field)

**Export Data (Bulk):**
```http
GET /api/shipments/export?format=csv&status=pending
```
**Query Parameters:**
- `format`: `xlsx` (default) or `csv`
- `status`: Filter by shipment status
- `type`: `import` or `export`
- `search`: Filter by tracking number or client name

**Response:** Returns a downloadable file (`shipments.xlsx` or `shipments.csv`).

**Explanations:**
- **Shipment Lifecycle:** Created as `PENDING`, moves to `IN_TRANSIT` (Logistics), then `DELIVERED` (PoD).
- **PoD (Proof of Delivery):** Closes the shipment loop. Requires a digital signature and a photo of the delivered goods.
- **Bulk Import:** Designed for enterprise partners. Ingests CSV files and maps them to the `Shipment` entity via the `bulk-import.controller`.
- **Activity History:** A "Flight Data Recorder" for each shipment. Every status update, note, and document upload is timestamped and logged.

### 3. 🛂 Customs & Route Updates
When customs clears a document or it moves cities, a status update is logged.

**Update Shipment Status:**
```http
PATCH /api/shipments/:id/status
```
```json
{
  "status": "customs",
  "location": "Lagos Seaport",
  "note": "Awaiting final clearance fee confirmation",
  "visibility": "public"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipment status updated.",
  "data": {
    "shipmentId": "uuid",
    "newStatus": "customs",
    "trackingEntry": {
      "checkpoint": "customs",
      "location": "Lagos Seaport",
      "date": "2026-04-22T08:10:00Z"
    }
  },
  "timestamp": "2026-04-22T08:10:00Z",
  "requestId": "uuid"
}
```

### 4. 🗂️ Document Management & Archiving
Staff upload waybills and manifests. Text is extracted securely server-side.

**Upload Document Request (Multipart/Form-Data Form)**
```text
POST /api/documents

Fields:
name=Commercial Invoice
documentType=financial
shipmentId=uuid
visibilityScope=DEPARTMENT

Files:
file=invoice_doc.pdf
```

**Upload Document Response**
```json
{
  "success": true,
  "message": "Document uploaded securely.",
  "data": {
    "id": "uuid",
    "name": "Commercial Invoice",
    "fileUrl": "https://s3.amazonaws.com/...",
    "status": "PENDING",
    "extractedText": "Invoice 101: Total Due $500..."
  },
  "timestamp": "2026-04-22T08:15:00Z",
  "requestId": "uuid"
}
```

**EDMS & Archive Flows:**

**Upload New Version:**
```http
POST /api/documents/:id/versions
```
**Body (Multipart):**
- `file`: New PDF/Image
- `comment`: "Updated customs clearance stamp"

**Archive Document:**
```http
PATCH /api/documents/:id/meta
```
```json
{
  "isArchived": true,
  "adminTags": ["verified", "2026-audit"],
  "commitMessage": "Moved to long-term storage"
}
```

**Explanations:**

### 5. 💰 Financial Settlement & Invoicing
Creating a consolidated invoice tying multiple transport charges together.

**Generate Invoice Request:**
```http
POST /api/invoices
```
```json
{
  "shipmentId": "uuid",
  "currency": "NGN",
  "dueDate": "2026-06-01",
  "taxRate": 7.5,
  "items": [
    {
      "description": "Base Air Freight Charge",
      "quantity": 1,
      "price": 450000
    },
    {
      "description": "Customs Duty Fee",
      "quantity": 1,
      "price": 120000
    }
  ],
  "notes": "Payment due within 30 days."
}
```

**Invoice Response:**
```json
{
  "success": true,
  "message": "Invoice generated successfully.",
  "data": {
    "id": "uuid",
    "invoiceNumber": "INV-EGL-00045",
    "subtotal": 570000,
    "taxAmount": 42750,
    "totalAmount": 612750,
    "status": "draft",
    "pdf_url": null
  },
  "timestamp": "2026-04-22T08:20:00Z",
  "requestId": "uuid"
}
```

**Payment Department & Verification Flows:**
EagleNet supports both automated Paystack payments and manual verification.

**Initialize Paystack Payment:**
```http
POST /api/payments/initialize
```
```json
{
  "shipmentId": "uuid",
  "amount": 5000,
  "callbackUrl": "https://frontend.eaglenet.com/verify"
}
```

**Manual Verification (Payment Dept):**
```http
PATCH /api/payments/:id/process
```
```json
{ 
  "status": "SUCCESS", 
  "notes": "Transfer confirmed in GTB Statement." 
}
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Payment success successfully.",
  "data": {
    "status": "SUCCESS",
    "processedAt": "2026-04-22T09:13:00Z",
    "user": { "outstandingBalance": 0, ... }
  }
}
```

**Explanations:**
- **Paystack Flow:** Automated. `initialize` returns a Paystack URL. `verify` or `webhook` confirms the transaction and auto-updates the User's `outstandingBalance`.
- **Payment Dept (Manual):** For transfers or cash. Staff upload a receipt to the Document module, then "Accept" the payment here. This ensures human oversight on high-value settlements.
- **Reconciliation:** Success in either flow triggers `reconcileInvoice()`, which balances the books and updates shipment flags.

### 6. ⚖️ Forensic Actions (Audit Subsystem)
All administrative or sensitive state changes are recorded immutably. Though you don't POST to an audit endpoint, querying it looks like this:

**Get Recent Audits Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "action": "status_change",
      "entityType": "Shipment",
      "entityId": "uuid-of-shipment",
      "performedBy": "John Doe",
      "timestamp": "2026-04-22T08:10:00Z",
      "details": {
        "previousStatus": "pending",
        "newStatus": "customs",
        "note": "Awaiting final clearance fee confirmation"
      }
    }
  ],
  "timestamp": "2026-04-22T08:25:00Z"
}
```

### 7. 🏢 Departmental Governance & Org Structure
Departments define the collaborative boundaries. A department has a supervisor, a dedicated email, and its own staff roster.

**Create Department Request (SuperAdmin Only):**
```http
POST /api/departments
```
```json
{
  "name": "Customs Operations",
  "email": "customs@eaglenet.com",
  "supervisorId": "uuid-of-supervisor",
  "status": "active"
}
```

**List Roles within Department:**
```http
GET /api/departments/roles
```

**Department Intelligence:**
*   **Staff Workload:** `GET /api/departments/:id/staff` (Lists staff + active shipment counts)
*   **Department Stats:** `GET /api/departments/:id` (Live shipment & financial metrics)

### 8. ⛓️ Parallel Workflow Orchestration
Shipments can be attached to workflows consisting of multiple parallel or sequential steps. Each step can be assigned to different departments.

**Attach Workflow to Shipment:**
```http
POST /api/workflows/:shipmentId/attach
```
```json
{
  "templateId": "uuid-standard-import",
  "steps": [
    {
      "name": "Warehouse Inspection",
      "departmentId": "uuid-warehouse",
      "priority": "high"
    }
  ]
}
```
**Success Response:**
```json
{
  "success": true,
  "message": "Workflow attached.",
  "data": {
    "workflowId": "uuid",
    "activeStep": "Warehouse Inspection",
    "completionStatus": 0
  }
}
```

### 9. 💬 Internal Messaging & Global Search
Staff can communicate within threads linked to specific shipments or entities, and perform global scoped searches.

**Send Message:**
```http
POST /api/messages
```
```json
{
  "recipientId": "uuid",
  "threadId": "shipment-uuid",
  "content": "Document #45 has been verified.",
  "messageType": "text"
}
```

**Get Inbox:**
```http
GET /api/messages/inbox
```
**Success Response:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "uuid",
      "userName": "Jane Admin",
      "lastMessage": "Invoice confirmed.",
      "unreadCount": 2,
      "timestamp": "2026-04-22T09:20:00Z"
    }
  ]
}
```

**Search Workflow:**
```http
GET /api/search?q=EGL-EXP&type=shipments
```

### 10. 🔔 Notifications & Preferences
Real-time alerts for shipment status changes, assignments, and financial updates.

**Get Notifications:**
```http
GET /api/notifications?unread=true
```
**Success Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Payment Verified 💰",
      "content": "Payment for EGL-00045 has been approved by Finance.",
      "isRead": false
    }
  ]
}
```

**Global Scoped Search:**
```http
GET /api/search?q=tracking-number&type=shipments
```

### 11. 🛡️ Fine-Grained Access Control (RBAC/ABAC)
EagleNet implements a multi-layered security model using both Role-Based and Attribute-Based Access Control.

- **SuperAdmin:** Absolute control over all system resources.
- **Admin:** Control over departmental resources and staff management.
- **Staff:** Base operational rights (Shipment creation, Document upload).
- **Departmental Roles:** Granular permissions (e.g., "Customs Officer" can only clear shipments in their department).

**Authorization Middleware Usage:**
```typescript
router.patch("/:id/status", authorize("shipment", "update"), updateStatus);
```

### 12. 📡 Real-time Communication & WebSockets
When a shipment is updated, the Socket engine immediately pushes an event.

**Client Socket Subscription (Socket.io payload):**
```json
"Event": "shipment_updated"
"Payload": {
  "shipmentId": "uuid",
  "trackingNumber": "EGL-EXP-240001",
  "status": "customs",
  "updatedBy": "Jane Customs Ops"
}
```

---

## 🏗️ System Architecture

The application is structured into domain-driven Feature Modules to ensure maintainability:

```text
src/
├── modules/
│   ├── audit/           # Forensic logging ecosystem
│   ├── auth/            # JWT issuance & Session management
│   ├── departments/     # Org structure & departmental scope
│   ├── documents/       # File uploads, S3 integration, Versioning
│   ├── financial/       # Payments, Paystack, Itemized Invoices
│   ├── messages/        # Internal websocket/REST chat system
│   ├── notifications/   # Email (Sendgrid/Resend) & Preferences
│   ├── roles/           # RBAC policy definitions
│   ├── search/          # Global scoping-aware unified search
│   ├── shipments/       # Core freight handling & lifecycle
│   ├── workflow/        # Parallel task orchestration & step management
│   └── users/           # IAM, Staff profiles
├── middleware/          # Security, Rate limiting, Token validators
├── jobs/                # Background chron jobs (Pingers)
└── server.ts            # Bootstrapper & Express config
```

---

## 💻 Developer Setup & Operations

### Prerequisites
- Node.js (v20+)
- PostgreSQL (v14+)
- AWS S3 or Backblaze B2 Bucket

### 1. Environment Configuration
Clone `.env.example` to `.env` and configure:
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/eaglenet

# Authentication
JWT_SECRET=super_secret_key_change_in_production
JWT_EXPIRES_IN=30d

# Payments
PAYSTACK_SECRET_KEY=sk_test_...

# Storage (S3 / B2)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=eaglenet-storage
```

### 2. Installation & Execution
```bash
# Install dependencies
npm install

# Run database migrations to sync schema
npm run migration:run

# Start the application in development mode (hot-reloading)
npm run dev

# Build the project
npm run build
```

### 3. Utility Commands
| Command | Description |
| :--- | :--- |
| `npm run create:ceo` | Bootstraps the initial SuperAdmin account in the DB |
| `npm run migration:generate` | Inspects Entity changes and generates a new SQL migration |
| `npm run typeorm` | CLI interface for direct TypeORM interactions |

---

## 🔒 Security Best Practices Implemented
- **Helmet:** Ensures secure HTTP headers.
- **Rate Limiting:** Global limits, with ultra-strict throttling on authentication routes.
- **HPP:** Protects against HTTP Parameter Pollution.
- **Bcrypt:** 12-round hashing for passwords and refresh tokens.
- **Write-Only Ledger:** Core audit logs are database-restricted from mutations.

---
<div align="center">
  <i>Built for the future of global internal logistics by the EagleNet Technical Operations Team.</i>
</div>

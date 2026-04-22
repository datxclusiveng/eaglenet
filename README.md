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

### 2. 🚢 Shipment & Logistics Orchestration
The primary lifecycle of freight management. Shipments are created and immediately assigned a tracking number.

**Create Shipment Request:**
```http
POST /api/shipments
```
```json
{
  "fullName": "Jane Client",
  "email": "client@business.com",
  "phoneNumber": "+2348012345678",
  "pickupAddress": "10 Broad Street",
  "pickupCity": "Lagos",
  "deliveryAddress": "45 Airport Road",
  "destinationCity": "Abuja",
  "preferredPickupDate": "2026-05-01",
  "preferredPickupTime": "10:00 AM",
  "weight": 25.5,
  "specialRequirements": "Keep refrigerated",
  "departmentId": "uuid-for-logistics-dept",
  "creationSource": "INTERNAL"
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

### 7. 📡 Real-time Communication & WebSockets
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
│   ├── shipments/       # Core freight handling & workflow orchestration
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

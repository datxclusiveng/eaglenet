# EagleNet Logistics - Backend Architecture & Workflow Guide

Welcome to the EagleNet Logistics API backend. This specialized platform is structured to mimic real-world enterprise freight, customs, and financial operations. This README serves as a step-by-step guide answering "How does this system work from start to finish?" including the exact API endpoints and payloads you need to execute the workflow.

---

## 🏗️ 1. Architecture Overview

**Tech Stack**: Node.js, Express, TypeScript, TypeORM, PostgreSQL.
**Design Pattern**: Feature-Modular Architecture. Instead of dumping all routes and controllers together, the system is strictly bounded by business context:
*   `modules/auth` & `modules/users`: Security, JWT generation, & RBAC (Role Based Access Control).
*   `modules/shipments`: The core operations engine (Tracing, Logistics, Bulk imports, Customs bridging).
*   `modules/financial`: Autonomous invoicing, sequential IDs, and Paystack webhooks.
*   `modules/notifications`: Resend/SMTP email integrations and push alerts.
*   `modules/audit`: Write-only forensic logging for accountability.

---

## 🔄 2. The Operational Workflow (Step-by-Step)

Here is exactly how a freight shipment moves entirely through the EagleNet backend logic, replicating real-life operational scenarios. All base URLs are relative to `http://localhost:3000/api`.

### Step 1: Identity & Authorization
Before anything happens, an officer or client must exist. We authenticate to get a Bearer Token.

**Login Route:** `POST /auth/login`
```json
{
    "email": "admin@eaglenet.com",
    "password": "password123"
}
```
*Take the `token` from the response and use it as a Bearer Token for subsequent requests.*

### Step 2: Shipment Orchestration
A client books a shipment (Air Freight or Sea Freight). 

**Create Shipment Route:** `POST /shipments`
```json
{
    "type": "air_freight",
    "clientName": "Acme Corp",
    "clientEmail": "logistics@acme.com",
    "clientPhone": "+1234567890",
    "originCountry": "USA",
    "originCity": "New York",
    "destinationCountry": "UK",
    "destinationCity": "London",
    "weightKg": 500,
    "volumeCbm": 2.5,
    "description": "Electronics",
    "airlineOrVessel": "British Airways"
}
```
*This generates a `trackingNumber` (e.g. `EGL-AF-20260413-001`) and triggers `logActivity()` to write the `PENDING` creation event into the `ShipmentLog` entity.*

**Update Shipment Status Route:** `PATCH /shipments/{shipmentId}/status`
```json
{
    "status": "in_transit",
    "note": "Departed from origin facility",
    "triggerEmail": true,
    "visibility": "public"
}
```

### Step 3: Customs & Regulatory Clearance
Once freight arrives globally, it requires inspection. Rather than bloating the main Shipment table, a 1-to-1 relations table handles customs clearance constraints.

**Update Customs Status Route:** `PATCH /shipments/{shipmentId}/customs`
```json
{
    "status": "under_examination",
    "remarks": "Inspecting cargo contents."
}
```
*When fees are settled and inspections clear, this is patched to `"status": "released"`.*

### Step 4: The Financial Lifecycle
Freight is cleared; the client owes EagleNet capital.

**Create Itemized Invoice Route:** `POST /invoices`
```json
{
    "shipmentId": "{shipmentId}",
    "items": [
        { "description": "Air Freight Charges", "quantity": 1, "price": 1500 },
        { "description": "Customs Handling", "quantity": 1, "price": 250 }
    ],
    "taxRate": 7.5,
    "currency": "NGN"
}
```
*Generates an ID like `INV-20260413-001`. The backend calculates subtotals and applies the tax dynamically.*

**Initialize Payment Route:** `POST /payments/initialize`
```json
{
    "shipmentId": "{shipmentId}",
    "amount": 1881.25
}
```
*The gateway creates an external webhook handshake, generating a Paystack secure bridge URL. Once payment clears, Paystack independently posts back to the webhook (`POST /payments/webhook`), deduplicating against the ledger and marking the invoice `PAID`.*

### Step 5: Post-Completion Notifications & Audit
You can pull the shipment history and tracking publicly.

**Track Public Shipment Route:** `GET /shipments/track/{trackingNumber}`
*(No Payload required. Returns a sanitized list of only `public` tracking logs associated with that shipment)*

**Get Dashboard Statistics Route:** `GET /shipments/stats`
*(No Payload required. Aggregates Postgres counts in real-time grouped by lifecycle status).*

---

## 🚀 3. Running It Locally

**Prerequisites:** 
- Node.js installed.
- Valid PostgreSQL server running locally or via Docker. 

**Steps:**
1. Clone the repo and ensure all packages are installed:
   ```bash
   npm install
   ```
2. Set up your `.env` securely (Database URL, JWT Secret, Paystack Keys).
3. Push the synchronized schema up to your DB:
   ```bash
   npm run typeorm migration:run -d database/data-source.ts
   ```
4. Start the Hot-Reloading Development Server:
   ```bash
   npm run dev
   ```

## 🛠️ Testing via Postman
We've included `eaglenet_postman_collection.json` inside the root directory. Drop that directly into Postman to have all of these exact endpoints readily mapped out for testing!

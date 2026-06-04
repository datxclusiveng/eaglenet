# EagleNet Logistics API

Backend API for the EagleNet logistics management platform — shipment tracking, financials, document management, workflow automation, and team collaboration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express 5 |
| Language | TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |
| Real-time | Socket.IO |
| Validation | Zod |
| Storage | Backblaze B2 (S3-compatible) |
| Email | SendGrid / Nodemailer / Resend |
| Logging | Winston |

## Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- Backblaze B2 bucket (for file uploads)
- SendGrid API key (for email)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/eaglenet

# JWT
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=30d

# Email
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@eaglenet.com

# Storage (Backblaze B2)
B2_KEY_ID=...
B2_APPLICATION_KEY=...
B2_BUCKET=...
B2_ENDPOINT=...
B2_REGION=...

# App
PORT=3000
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### Install & Run

```bash
npm install
npm run dev       # Development with ts-node + hot reload
npm run build     # Compile TypeScript
npm start         # Production
```

### First User

On first registration, the user is automatically assigned the `SUPERADMIN` role. All subsequent registrations default to `STAFF`.

---

## Authentication

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | — | Register (first user → SUPERADMIN) |
| `POST` | `/api/auth/login` | — | Login, returns tokens + user + permissions |
| `GET` | `/api/auth/me` | JWT | Current user profile + permissions |
| `GET` | `/api/auth/permissions` | JWT | Permission map only (no user data) |
| `POST` | `/api/auth/refresh` | — | Refresh access token |
| `POST` | `/api/auth/logout` | JWT | Logout (clear refresh token) |
| `POST` | `/api/auth/logout-all` | JWT | Logout all devices (increment tokenVersion) |
| `PATCH` | `/api/auth/change-password` | JWT | Change password |
| `POST` | `/api/auth/forgot-password` | — | Send 6-digit OTP to email |
| `POST` | `/api/auth/reset-password` | — | Reset password with OTP |

### Token Flow

1. **Login** → receive `{ token, refreshToken, user, permissions }`
2. Use `Authorization: Bearer <token>` on all authenticated requests
3. When the access token expires, call `/api/auth/refresh` with `{ token, refreshToken }`
4. On global logout or password change, `tokenVersion` increments, invalidating all JWTs

---

## Permission System

EagleNet uses a **dual-layer** permission model:

### Layer 1: System Roles (`User.role`)

| Role | Scope |
|------|-------|
| `SUPERADMIN` | Everything — bypasses all checks |
| `ADMIN` | Everything — bypasses all checks |
| `STAFF` | Restricted by departmental role permissions + fast-path whitelist |

### Layer 2: Departmental Roles (ABAC)

STAFF users are assigned to departments with roles (e.g., "Dispatcher" in "Operations"). Each role has a set of `resource:action` permissions scoped to `own`, `department`, or `all`.

**Entities:**
- `Permission` — `{ resource, action, scope, conditions }`
- `Role` — Named collection of permissions (e.g., "Accountant")
- `UserDepartmentRole` — Links a user to a department with a role

### Staff Fast-Path Whitelist

Even without departmental role assignments, STAFF users can:
- `shipment:create`, `shipment:read`
- `document:create`, `document:read`, `document:update`
- `invoice:read`
- `payment:create`, `payment:read`
- `search:read`

These are granted at `scope: own`.

---

## Permission Map (Frontend Contract)

On login, `/api/auth/me`, and `GET /api/auth/permissions`, the API returns a permission map so the frontend can conditionally render UI elements without probing endpoints.

### Response Shape

```json
{
  "status": "success",
  "data": {
    "role": "STAFF",
    "departments": [
      {
        "departmentId": "abc-123",
        "departmentName": "Operations",
        "roleName": "Dispatcher",
        "permissions": ["shipment:read", "shipment:update", "document:read"]
      }
    ],
    "map": {
      "shipment:create":  { "allowed": true,  "scope": "own",        "conditional": false },
      "shipment:read":    { "allowed": true,  "scope": "all",        "conditional": false },
      "shipment:delete":  { "allowed": false, "scope": null,         "conditional": false },
      "invoice:approve":  { "allowed": true,  "scope": "department", "conditional": true  },
      "invoice:submit":   { "allowed": false, "scope": null,         "conditional": false }
    }
  }
}
```

### Map Keys

All known `resource:action` pairs are present — even those the user is denied. This means a simple boolean check:

```typescript
const canCreate = permissions.map["shipment:create"]?.allowed ?? false;
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | `boolean` | Whether the user can perform this action at all |
| `scope` | `"own" \| "department" \| "all" \| null` | Data visibility scope — `null` when denied |
| `conditional` | `boolean` | If `true`, ABAC conditions apply — show the action in the UI but the backend may still deny it at runtime |

### Scope Meaning

| Scope | Frontend Implication |
|-------|---------------------|
| `own` | Show only items the user created/owns |
| `department` | Show all items in the user's department |
| `all` | Show everything across the organization |
| `null` | Access denied — hide the feature entirely |

### Frontend Usage Pattern

```typescript
// Auth store
const permissions = ref<PermissionMap | null>(null);

async function login(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  permissions.value = res.data.permissions;
  return res.data;
}

async function refreshPermissions() {
  const res = await api.get("/auth/permissions");
  permissions.value = res.data;
}

// Component-level guard
function can(action: string): boolean {
  return permissions.value?.map?.[action]?.allowed ?? false;
}

// Usage in templates:
//   <button v-if="can('invoice:approve')">Approve</button>
//   <Tab v-if="can('shipment:read')">Shipments</Tab>

// Scope-aware data fetching
function shipmentParams() {
  const scope = permissions.value?.map?.["shipment:read"]?.scope;
  if (scope === "own") return { assignedTo: currentUserId };
  if (scope === "department") return { departmentId: currentDeptId };
  return {}; // "all" — no filter
}
```

### Refreshing Permissions

After an admin changes a user's roles or permissions, the affected user should call:

```typescript
// Option A: Refetch permission map only
await api.get("/auth/permissions");

// Option B: Full profile refresh (includes user data)
await api.get("/auth/me");
```

The permission map is **cached server-side for 5 minutes** (keyed by `userId:tokenVersion`). Role/permission modifications by admins automatically invalidate affected users' caches.

### Complete Resource:Action Reference

| Resource | Actions |
|----------|---------|
| `shipment` | `create`, `read`, `update`, `delete`, `approve` |
| `customs` | `read`, `update` |
| `invoice` | `create`, `read`, `update`, `delete`, `verify`, `approve`, `reconcile`, `submit` |
| `bank-account` | `create`, `read`, `update`, `delete` |
| `payment` | `create`, `read`, `update`, `delete`, `process` |
| `voucher` | `create`, `read`, `update`, `delete`, `verify`, `approve`, `pay` |
| `cashbook` | `create`, `read`, `update`, `delete` |
| `ledger` | `create`, `read`, `update`, `delete` |
| `document` | `create`, `read`, `update`, `delete`, `verify` |
| `workflow` | `create`, `read`, `update`, `attach` |
| `audit` | `read` |
| `department` | `create`, `read`, `update`, `delete` |
| `user` | `create`, `read`, `update`, `deactivate`, `upgrade` |
| `role` | `create`, `read`, `update` |
| `permission` | `create`, `read` |
| `customer` | `create`, `read` |
| `message` | `create`, `read`, `update`, `delete` |
| `channel` | `create`, `read`, `update`, `delete` |
| `mail` | `read`, `send` |
| `warehouse` | `create`, `read`, `update`, `delete` |
| `search` | `read` |

### Cache Invalidation Triggers

Permission caches are invalidated automatically when:
- A user's system role changes (upgrade/downgrade)
- A user is assigned to or removed from a departmental role
- A role's permissions are updated
- A role is deleted
- A user is deactivated

---

## API Modules

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/auth` | Login, register, tokens, password reset |
| Users | `/api/users` | User management, dashboards, signatures |
| Roles | `/api/roles` | Departmental role CRUD |
| Permissions | `/api/permissions` | Permission definition browsing |
| Departments | `/api/departments` | Department CRUD + staff assignments |
| Shipments | `/api/shipments` | Shipment lifecycle management |
| Services | `/api/services` | Service type definitions |
| Documents | `/api/documents` | Document upload and management |
| Payments | `/api/payments` | Payment processing (Paystack webhook) |
| Invoices | `/api/invoices` | Invoice management |
| Bank Accounts | `/api/bank-accounts` | Bank account records |
| Vouchers | `/api/vouchers` | Voucher management |
| Cashbook | `/api/cashbook` | Cashbook entries |
| Ledger | `/api/ledger` | General ledger |
| Warehouse | `/api/warehouse` | Inbound/outbound warehouse entries |
| Workflows | `/api/workflows` | Workflow automation |
| Audit | `/api/audit` | Immutable audit log (read-only) |
| Messages | `/api/messages` | Internal messaging |
| Channels | `/api/channels` | Message channel management |
| Notifications | `/api/notifications` | Notification preferences |
| Mail | `/api/mail` | Email sending |
| Search | `/api/search` | Full-text search |
| Reports | `/api/reports` | Reporting and analytics |
| Customers | `/api/customers` | Customer records |
| Admin | `/api/admin` | Admin dashboard + analytics |
| **Public Track** | `/api/track` | **No auth** — customer parcel lookup |

---

## Public Tracking (Customer Parcel Lookup)

The `/api/track` endpoint is **public** — no authentication required. Customers can look up their shipment status using their tracking number or search for all shipments linked to their email address.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/track?trackingNumber=EGL-EXP-240001` | — | Full tracking detail for a single shipment |
| `GET` | `/api/track?email=customer@example.com` | — | Summary list of shipments for that customer |

Provide **exactly one** query parameter per request.

### Rate Limiting

30 requests per 15 minutes per IP address. Exceeding this returns `429 Too Many Requests`.

### Single Shipment Response (`?trackingNumber=`)

Returns detailed public-safe information about one shipment:

```json
{
  "status": "success",
  "data": {
    "trackingNumber": "EGL-EXP-240001",
    "shipmentName": "Medical Supplies to Kenya",
    "type": "export",
    "status": "in_transit",
    "origin": { "city": "Lagos", "country": "Nigeria" },
    "destination": { "city": "Nairobi", "country": "Kenya" },
    "weightKg": 250.5,
    "volumeCbm": 2.3,
    "description": "Urgent medical supplies",
    "clientName": "Nairobi Health Ltd",
    "trackingUpdates": [
      { "checkpoint": "Departed Origin", "location": "Lagos, Nigeria", "status": "in_transit", "date": "2026-05-20T10:00:00Z" }
    ],
    "customsStatus": "released",
    "publicLogs": [
      { "status": "in_transit", "date": "2026-05-20T10:00:00Z", "note": "Departed Lagos airport" }
    ]
  }
}
```

### Email Search Response (`?email=`)

Returns a summary list (up to 50 most recent shipments):

```json
{
  "status": "success",
  "data": [
    {
      "trackingNumber": "EGL-EXP-240001",
      "shipmentName": "Medical Supplies to Kenya",
      "status": "in_transit",
      "type": "export",
      "origin": { "city": "Lagos", "country": "Nigeria" },
      "destination": { "city": "Nairobi", "country": "Kenya" }
    }
  ],
  "meta": { "count": 1 }
}
```

### What Is NOT Exposed

This endpoint deliberately excludes all sensitive/internal fields:
- No staff names, IDs, or assigned officer
- No department or collaborator info
- No financial data (invoice IDs, payment info, amounts)
- No document URLs or file keys
- No full street addresses (city + country only)
- No client email or phone
- No workflow steps, internal notes, or customs remarks
- No carrier/airline details

### Error Responses

| Status | Condition |
|--------|-----------|
| `400` | Missing or invalid query params (must provide exactly one of `trackingNumber` or `email`) |
| `404` | No shipment found with that tracking number |
| `429` | Rate limit exceeded |

---

## Email System

EagleNet supports sending emails through multiple providers with Handlebars templating, file attachments, and full audit logging.

### Providers

| Provider | Env Config | Description |
|----------|-----------|-------------|
| **Resend** | `MAIL_PROVIDER=resend` (default) | Cloud email API via `resend` SDK |
| **SMTP** | `MAIL_PROVIDER=smtp` | Self-hosted or relay SMTP via Nodemailer |
| **Console** | `MAIL_PROVIDER=console` | Logs emails to stdout (dev/test) |

Additional env vars:

```env
MAIL_PROVIDER=resend
MAILING_ENABLED=1          # Set to "0" to disable all outgoing mail
RESEND_API_KEY=re_xxx       # Required for Resend
MAIL_FROM=noreply@eaglenet.com

# SMTP (only needed when MAIL_PROVIDER=smtp)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASS=password
```

### Mail Endpoints

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| `GET` | `/api/mail` | JWT | `mail:read` | List mail logs (admin) |
| `POST` | `/api/mail/send` | JWT | `mail:send` | Send a custom email |

### Sending Email

#### Plain Email (JSON)

Send a simple HTML email with no attachments:

```http
POST /api/mail/send
Content-Type: application/json
Authorization: Bearer <token>

{
  "to": "customer@example.com",
  "subject": "Your Invoice from EagleNet",
  "body": "<h1>Invoice #1234</h1><p>Thank you for your business.</p>"
}
```

#### Email with Attachments (Multipart)

Send an email with file attachments (e.g., PDF invoices) using `multipart/form-data`:

```http
POST /api/mail/send
Content-Type: multipart/form-data
Authorization: Bearer <token>

Fields:
  to: customer@example.com
  subject: Your Invoice from EagleNet
  body: <h1>Invoice #1234</h1><p>Please find your invoice attached.</p>

Files:
  attachments: invoice-1234.pdf
  attachments: receipt-5678.pdf   (up to 10 files)
```

**Attachment behavior:**
- Each file is uploaded to Backblaze B2 under the `mail-attachments/` folder for permanent audit trail
- File buffers are attached directly to the outgoing email (no download links needed — the customer gets the actual file)
- Max 10 files per email, each up to 20 MB
- Accepted file types: JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP
- All files undergo magic-byte validation to prevent MIME spoofing

### Frontend Usage (Attaching a Generated PDF)

```typescript
// Example: Generate an invoice PDF client-side, then email it
async function sendInvoiceEmail(customerEmail: string, pdfBlob: Blob, invoiceNumber: string) {
  const formData = new FormData();
  formData.append("to", customerEmail);
  formData.append("subject", `Invoice #${invoiceNumber} from EagleNet`);
  formData.append("body", `<h1>Invoice #${invoiceNumber}</h1><p>Please find your invoice attached.</p>`);
  formData.append("attachments", pdfBlob, `invoice-${invoiceNumber}.pdf`);

  await fetch("/api/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData, // Content-Type is set automatically by the browser for FormData
  });
}
```

### Audit Logging

Every email sent is recorded in the `email_logs` table:

| Column | Description |
|--------|-------------|
| `recipient_email` | Who received the email |
| `subject` | Email subject line |
| `template_used` | Which Handlebars template was used (if any) |
| `body` | Full HTML body sent |
| `status` | `sent`, `failed`, or `bounced` |
| `attachment_count` | Number of files attached (null = none) |
| `attachment_urls` | JSON array of `{ name, url }` for each attachment stored in B2 |
| `sent_by` | Staff/admin who sent the email |
| `shipment_id` | Linked shipment (if template-based) |
| `invoice_id` | Linked invoice (if template-based) |
| `error_message` | Provider error details (if failed) |
| `sent_at` | Timestamp |

### Built-in Template Functions

These are called internally by the system — they use Handlebars templates from `src/templates/emails/`:

| Function | Trigger |
|----------|---------|
| `sendBookingConfirmationEmail` | Shipment is booked |
| `sendStatusUpdateEmail` | Shipment status changes |
| `sendWelcomeEmail` | New user registration |
| `sendPasswordResetCodeEmail` | Password reset requested |
| `sendPasswordResetEmail` | Password reset link sent |

All templates are rendered with shared partials (`src/templates/emails/partials/`) and include branding, logo, and consistent styling.

---

## Warehouse (Inbound / Outbound)

Manages goods flowing through the warehouse — serial-numbered entries tracking clients, AWB numbers, weights, packages, and date ranges. Every action is audit-logged. Deleted entries are soft-deleted (never permanently removed).

**Base URL:** `/api/warehouse`

---

### 1. Create Entry

```
POST /api/warehouse
```

**Headers**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `sn` | string | **Yes** | Non-empty, unique across all entries | Serial number |
| `direction` | enum | **Yes** | `"inbound"` or `"outbound"` | Direction of goods flow |
| `clients` | string | **Yes** | Non-empty | Client name(s) |
| `awb` | string | **Yes** | Non-empty | Air waybill number |
| `weight` | number | No | Positive decimal (max 10, scale 2) | Weight in kg |
| `pkgs` | number | No | Positive integer | Number of packages |
| `description` | string | No | — | Item description |
| `dateIn` | string | **Yes** | Format `YYYY-MM-DD` | Date goods arrived |
| `dateOut` | string | No | Format `YYYY-MM-DD` | Date goods departed |
| `remarks` | string | No | — | Additional notes |

**Example Request**
```json
{
  "sn": "WH-2026-001",
  "direction": "inbound",
  "clients": "Acme Corp",
  "awb": "AWB-12345678",
  "weight": 250.50,
  "pkgs": 5,
  "description": "Electronics shipment from Shenzhen",
  "dateIn": "2026-06-01",
  "remarks": "Received in good condition"
}
```

**Success Response** — `201 Created`
```json
{
  "status": "success",
  "data": {
    "id": "a1b2c3d4-...",
    "sn": "WH-2026-001",
    "direction": "inbound",
    "clients": "Acme Corp",
    "awb": "AWB-12345678",
    "weight": "250.50",
    "pkgs": 5,
    "description": "Electronics shipment from Shenzhen",
    "dateIn": "2026-06-01",
    "dateOut": null,
    "remarks": "Received in good condition",
    "createdBy": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "john@eaglenet.com" },
    "isDeleted": false,
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-01T10:00:00.000Z",
    "deletedAt": null
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Validation failed", "errors": { ... } }` | Missing required field, invalid date format, non-positive weight, duplicate SN |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `warehouse:create` permission |
| `500` | `{ "status": "error", "message": "Error creating warehouse entry." }` | Database error or duplicate serial number |

> `createdById` is automatically set from the authenticated user's JWT. All actions are recorded in the immutable audit log.

---

### 2. List Own Entries

```
GET /api/warehouse/my
```

Returns entries created by the authenticated user (based on JWT). No permission check — any authenticated user can view their own entries.

**Headers**
```
Authorization: Bearer <jwt>
```

**Query Parameters** — all optional
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page |
| `direction` | string | — | Filter by `"inbound"` or `"outbound"` |
| `startDateIn` | string | — | `dateIn >= value` (format `YYYY-MM-DD`) |
| `endDateIn` | string | — | `dateIn <= value` (format `YYYY-MM-DD`) |
| `startDateOut` | string | — | `dateOut >= value` (format `YYYY-MM-DD`) |
| `endDateOut` | string | — | `dateOut <= value` (format `YYYY-MM-DD`) |

**Example Request**
```
GET /api/warehouse/my?direction=inbound&startDateIn=2026-05-01&endDateIn=2026-06-30&page=1&limit=10
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "data": [
    {
      "id": "a1b2c3d4-...",
      "sn": "WH-2026-001",
      "direction": "inbound",
      "clients": "Acme Corp",
      "awb": "AWB-12345678",
      "weight": "250.50",
      "pkgs": 5,
      "description": "Electronics shipment from Shenzhen",
      "dateIn": "2026-06-01",
      "dateOut": null,
      "remarks": "Received in good condition",
      "createdBy": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "john@eaglenet.com" },
      "isDeleted": false,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `500` | `{ "status": "error", "message": "Error listing your warehouse entries." }` | Database error |

> Results are ordered by `dateIn DESC`, then `createdAt DESC`. Soft-deleted entries are excluded.

---

### 3. List All Entries

```
GET /api/warehouse
```

Returns all non-deleted entries across all users. Requires `warehouse:read` permission.

**Headers**
```
Authorization: Bearer <jwt>
```

**Query Parameters** — all optional
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page |
| `direction` | string | — | Filter by `"inbound"` or `"outbound"` |
| `clients` | string | — | Case-insensitive ILIKE search on client name |
| `awb` | string | — | Case-insensitive ILIKE search on AWB |
| `startDateIn` | string | — | `dateIn >= value` (format `YYYY-MM-DD`) |
| `endDateIn` | string | — | `dateIn <= value` (format `YYYY-MM-DD`) |
| `startDateOut` | string | — | `dateOut >= value` (format `YYYY-MM-DD`) |
| `endDateOut` | string | — | `dateOut <= value` (format `YYYY-MM-DD`) |

> Unlike `/my`, this endpoint also supports `clients` and `awb` ILIKE search since it spans all users.

**Example Request**
```
GET /api/warehouse?direction=outbound&clients=Acme&startDateOut=2026-06-01&page=1&limit=20
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "data": [ /* array of entries — same shape as /my endpoint */ ],
  "meta": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `warehouse:read` permission |
| `500` | `{ "status": "error", "message": "Error listing warehouse entries." }` | Database error |

> Results ordered by `dateIn DESC`, then `createdAt DESC`. Soft-deleted entries excluded.

---

### 4. Get Single Entry

```
GET /api/warehouse/:id
```

Returns a single entry by its UUID. Requires `warehouse:read` permission.

**Headers**
```
Authorization: Bearer <jwt>
```

**Path Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Entry ID (UUID v4) |

**Example Request**
```
GET /api/warehouse/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "sn": "WH-2026-001",
    "direction": "inbound",
    "clients": "Acme Corp",
    "awb": "AWB-12345678",
    "weight": "250.50",
    "pkgs": 5,
    "description": "Electronics shipment from Shenzhen",
    "dateIn": "2026-06-01",
    "dateOut": null,
    "remarks": "Received in good condition",
    "createdBy": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "john@eaglenet.com" },
    "isDeleted": false,
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-01T10:00:00.000Z",
    "deletedAt": null
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Validation failed", "errors": { "params": { "id": "Invalid uuid" } } }` | ID is not a valid UUID |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `warehouse:read` permission |
| `404` | `{ "status": "error", "message": "Warehouse entry not found." }` | Entry doesn't exist or is soft-deleted |
| `500` | `{ "status": "error", "message": "Error retrieving warehouse entry." }` | Database error |

> The `createdBy` field is sanitized — passwords, refresh tokens, and balances are stripped from the nested user object.

---

### 5. Update Entry

```
PATCH /api/warehouse/:id
```

Partially updates an entry. Only send the fields you want to change — all fields are optional. Requires `warehouse:update` permission.

**Headers**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Path Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Entry ID (UUID v4) |

**Request Body** — all fields optional
| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `sn` | string | Non-empty, must be unique | Serial number |
| `direction` | enum | `"inbound"` or `"outbound"` | Direction of goods flow |
| `clients` | string | Non-empty | Client name(s) |
| `awb` | string | Non-empty | Air waybill number |
| `weight` | number | Positive decimal | Weight in kg |
| `pkgs` | number | Positive integer | Number of packages |
| `description` | string | — | Item description |
| `dateIn` | string | Format `YYYY-MM-DD` | Date goods arrived |
| `dateOut` | string | Format `YYYY-MM-DD` | Date goods departed |
| `remarks` | string | — | Additional notes |

**Example Request**
```json
{
  "dateOut": "2026-06-05",
  "remarks": "Outbound — delivered to client",
  "weight": 248.00
}
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "a1b2c3d4-...",
    "sn": "WH-2026-001",
    "direction": "inbound",
    "clients": "Acme Corp",
    "awb": "AWB-12345678",
    "weight": "248.00",
    "pkgs": 5,
    "description": "Electronics shipment from Shenzhen",
    "dateIn": "2026-06-01",
    "dateOut": "2026-06-05",
    "remarks": "Outbound — delivered to client",
    "createdBy": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "john@eaglenet.com" },
    "isDeleted": false,
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-05T14:30:00.000Z",
    "deletedAt": null
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Validation failed", "errors": { ... } }` | Invalid date format, non-positive weight, duplicate SN |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `warehouse:update` permission |
| `404` | `{ "status": "error", "message": ... }` | Entry not found or is soft-deleted (TypeORM `findOneOrFail`) |
| `500` | `{ "status": "error", "message": "Error updating warehouse entry." }` | Database error |

> The audit log records which fields were changed, who changed them, and the entry's SN. The `updatedAt` timestamp is set automatically.

---

### 6. Delete Entry (Soft Delete)

```
DELETE /api/warehouse/:id
```

Soft-deletes an entry — sets `isDeleted = true` but does not remove the row from the database. Requires `warehouse:delete` permission.

**Headers**
```
Authorization: Bearer <jwt>
```

**Path Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Entry ID (UUID v4) |

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "message": "Warehouse entry deleted."
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Validation failed" }` | ID is not a valid UUID |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `warehouse:delete` permission |
| `404` | `{ "status": "error", "message": ... }` | Entry not found or already soft-deleted |
| `500` | `{ "status": "error", "message": "Error deleting warehouse entry." }` | Database error |

> Soft-deleted entries are hidden from all GET endpoints. The audit log records the deletion event with the entry ID. No response body other than the success message.

---

### Response Field Reference

Every entry returned by GET endpoints includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `sn` | string | Serial number (unique, indexed) |
| `direction` | `"inbound"` \| `"outbound"` | Goods direction |
| `clients` | string | Client name(s) |
| `awb` | string | Air waybill number |
| `weight` | string \| null | Weight in kg (decimal returned as string for precision) |
| `pkgs` | number \| null | Number of packages |
| `description` | string \| null | Item description |
| `dateIn` | string | Arrival date (`YYYY-MM-DD`) |
| `dateOut` | string \| null | Departure date (`YYYY-MM-DD`) |
| `remarks` | string \| null | Additional notes |
| `createdBy` | object \| null | Sanitized user object `{ id, firstName, lastName, email, role, ... }` |
| `isDeleted` | boolean | Soft-delete flag (always `false` in responses — deleted entries are filtered) |
| `createdAt` | ISO 8601 | Creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |
| `deletedAt` | ISO 8601 \| null | Soft-delete timestamp |

### Query Filter Quick Reference

| Param | Applies To | Type | Example |
|-------|-----------|------|---------|
| `direction` | `/`, `/my` | exact match | `direction=inbound` |
| `clients` | `/` only | ILIKE | `clients=Acme` |
| `awb` | `/` only | ILIKE | `awb=12345` |
| `startDateIn` | `/`, `/my` | `>=` | `startDateIn=2026-06-01` |
| `endDateIn` | `/`, `/my` | `<=` | `endDateIn=2026-06-30` |
| `startDateOut` | `/`, `/my` | `>=` | `startDateOut=2026-06-01` |
| `endDateOut` | `/`, `/my` | `<=` | `endDateOut=2026-06-30` |
| `page` | `/`, `/my` | number | `page=1` |
| `limit` | `/`, `/my` | number | `limit=20` |

### Audit Trail

Every warehouse mutation (create, update, soft-delete) writes to the system audit log with:
- `entityType`: `"WarehouseEntry"`
- `entityId`: the entry's UUID
- `action`: `CREATE`, `UPDATE`, or `DELETE`
- `actionDetails`: the changed fields, serial number, and direction
- `performedBy`: the authenticated user's ID
- `ipAddress` and `userAgent`: from the request

Use `GET /api/audit?entityType=WarehouseEntry` (with `audit:read` permission) to inspect the full history of warehouse changes.

---

## Vouchers (Request for Cash / Payment Authority / Cash Payment Voucher)

Manages financial voucher lifecycle — creation, approval/rejection, and marking as paid with evidence. Three voucher types support different financial workflows: staff cash requests, bank transfer payment authorities, and cash payment vouchers.

**Base URL:** `/api/vouchers`

### Voucher Types

| Type | Enum Value | Use Case |
|------|-----------|----------|
| Request for Cash | `REQUEST_FOR_CASH` | Staff member requests cash for expenses |
| Payment Authority | `PAYMENT_AUTHORITY` | Authorization to pay a beneficiary via bank transfer |
| Cash Payment Voucher | `CASH_PAYMENT_VOUCHER` | Record of cash paid out with line items |

### Voucher Status Flow

```
PENDING → APPROVED → PAID (terminal — new)
PENDING → REJECTED (terminal)
```

Only vouchers in `APPROVED` status can be marked as `PAID`. Once paid, the status is terminal.

---

### 1. Create Voucher

```
POST /api/vouchers
```

Requires `voucher:create` permission. Supports multipart file uploads for receipts and signatures.

**Headers**
```
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

**Request Body Fields**
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `voucherType` | enum | **Yes** | `REQUEST_FOR_CASH`, `PAYMENT_AUTHORITY`, or `CASH_PAYMENT_VOUCHER` | Type of voucher |
| `date` | string | **Yes** | Format `YYYY-MM-DD` | Voucher date |
| `amount` | number | **Yes** | Positive decimal | Amount |
| `totalAmount` | number | No | Positive decimal | Total (defaults to `amount`) |
| `purpose` | string | No | — | Purpose of the voucher |

**Type-Specific Fields**
| Field | Type | Applies To | Description |
|-------|------|-----------|-------------|
| `staffId` | UUID | Request for Cash | Staff member requesting cash |
| `bankTransferDate` | string | Payment Authority | Date of bank transfer (YYYY-MM-DD) |
| `beneficiaryName` | string | Payment Authority | Name of beneficiary |
| `particulars` | array | Cash Payment Voucher | JSON array of `{ sn, particulars, amount }` objects |
| `amountInWords` | string | Cash Payment Voucher | Amount written in words |
| `itemsDescription` | string | Cash Payment Voucher | Description of items purchased |
| `itemsCount` | number | Cash Payment Voucher | Number of items |
| `receivedById` | UUID | Cash Payment Voucher | User who received the cash |
| `receivedByName` | string | Cash Payment Voucher | Name of receiver |
| `issuedById` | UUID | Cash Payment Voucher | User who issued the cash |

**Upload Fields** (multipart file uploads — each max 1 file)
| Field | Description |
|-------|-------------|
| `receipt` | General receipt or attachment |
| `staffSignature` | Signature for Request for Cash staff |
| `receivedBySignature` | Signature of cash receiver |
| `issuedBySignature` | Signature of cash issuer |

> If no signature file is uploaded, the system falls back to the referenced user's pre-configured `signatureUrl` (or the creator's signature).

**Example Request** (JSON — no files)
```json
{
  "voucherType": "REQUEST_FOR_CASH",
  "date": "2026-06-02",
  "purpose": "Office supplies for Operations dept",
  "amount": 50000,
  "staffId": "a1b2c3d4-..."
}
```

**Success Response** — `201 Created`
```json
{
  "status": "success",
  "message": "Voucher created successfully.",
  "data": {
    "id": "v1b2c3d4-...",
    "voucherNumber": "EGL-VCH-1234567890",
    "voucherType": "REQUEST_FOR_CASH",
    "date": "2026-06-02",
    "purpose": "Office supplies for Operations dept",
    "amount": "50000.00",
    "totalAmount": "50000.00",
    "status": "PENDING",
    "staffId": "a1b2c3d4-...",
    "createdById": "u1b2c3d4-...",
    "createdAt": "2026-06-02T10:00:00.000Z",
    "updatedAt": "2026-06-02T10:00:00.000Z"
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Validation failed", "errors": { ... } }` | Missing required field, invalid date, negative amount |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `voucher:create` permission |
| `500` | `{ "status": "error", "message": "Error creating voucher." }` | Database or S3 error |

> Voucher numbers are auto-generated as `EGL-VCH-<timestamp><random>`. `createdById` is set automatically from the JWT.

---

### 2. List All Vouchers

```
GET /api/vouchers
```

Requires `voucher:read` permission. Returns paginated list with optional type/status filtering.

**Headers**
```
Authorization: Bearer <jwt>
```

**Query Parameters** — all optional
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page |
| `voucherType` | string | — | Filter by `REQUEST_FOR_CASH`, `PAYMENT_AUTHORITY`, or `CASH_PAYMENT_VOUCHER` |
| `status` | string | — | Filter by `PENDING`, `APPROVED`, `REJECTED`, or `PAID` |

**Example Request**
```
GET /api/vouchers?status=APPROVED&voucherType=PAYMENT_AUTHORITY&page=1&limit=20
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "data": [
    {
      "id": "v1b2c3d4-...",
      "voucherNumber": "EGL-VCH-1234567890",
      "voucherType": "PAYMENT_AUTHORITY",
      "date": "2026-06-01",
      "purpose": "Vendor payment — Lagos supplies",
      "amount": "250000.00",
      "totalAmount": "250000.00",
      "status": "APPROVED",
      "beneficiaryName": "Acme Supplies Ltd",
      "authorizedById": "a1b2c3d4-...",
      "authorizedAt": "2026-06-01T14:30:00.000Z",
      "createdBy": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@eaglenet.com" },
      "staff": null,
      "paidBy": null,
      "createdAt": "2026-06-01T09:00:00.000Z",
      "updatedAt": "2026-06-01T14:30:00.000Z"
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

> All signature and receipt URLs are resolved to presigned download URLs before being returned. Results ordered by `createdAt DESC`.

---

### 3. List My Vouchers

```
GET /api/vouchers/my
```

Returns vouchers created by the authenticated user. No special permission required — any logged-in user can see their own voucher history.

**Headers**
```
Authorization: Bearer <jwt>
```

**Query Parameters** — same as List All Vouchers (`page`, `limit`, `voucherType`, `status`)

**Success Response** — `200 OK` (same shape as List All)

---

### 4. Get Single Voucher

```
GET /api/vouchers/:id
```

Requires `voucher:read` permission. Returns full details with all relations resolved.

**Headers**
```
Authorization: Bearer <jwt>
```

**Path Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Voucher ID (UUID v4) |

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "v1b2c3d4-...",
    "voucherNumber": "EGL-VCH-1234567890",
    "voucherType": "CASH_PAYMENT_VOUCHER",
    "date": "2026-06-01",
    "purpose": "Petty cash — cleaning supplies",
    "amount": "15000.00",
    "status": "PAID",
    "particulars": [
      { "sn": 1, "particulars": "Cleaning detergent (5L)", "amount": 5000 },
      { "sn": 2, "particulars": "Mop and bucket set", "amount": 10000 }
    ],
    "receivedByName": "John Smith",
    "authorizedBy": { "id": "uuid", "firstName": "Admin", "lastName": "User", "email": "admin@eaglenet.com" },
    "paidBy": { "id": "uuid", "firstName": "Finance", "lastName": "Officer", "email": "finance@eaglenet.com" },
    "paidAt": "2026-06-02T09:00:00.000Z",
    "paymentMethod": "cash",
    "paymentReference": "Teller-00123",
    "paymentNotes": "Handed to John at HQ",
    "createdBy": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@eaglenet.com" },
    "createdAt": "2026-06-01T08:00:00.000Z",
    "updatedAt": "2026-06-02T09:00:00.000Z"
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Validation failed" }` | ID is not a valid UUID |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `voucher:read` permission |
| `404` | `{ "status": "error", "message": "Voucher not found." }` | Voucher doesn't exist |
| `500` | `{ "status": "error", "message": "Error retrieving voucher." }` | Database error |

---

### 5. Approve or Reject a Voucher

```
PATCH /api/vouchers/:id/status
```

Requires `voucher:update` permission. Only `PENDING` vouchers can be approved or rejected.

**Headers**
```
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

**Path Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Voucher ID (UUID v4) |

**Request Body Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | enum | **Yes** | `"APPROVED"` or `"REJECTED"` |
| `rejectionReason` | string | No (required if REJECTED) | Reason for rejection |
| `authorizedSignatureUrl` | string | No | Pre-existing signature URL |

**Upload Field**
| Field | Description |
|-------|-------------|
| `authorizedSignature` | Signature file of the authorizing officer |

> If no signature file is uploaded, the system falls back to the authorizer's pre-configured `signatureUrl`.

**Example Request** (JSON)
```json
{
  "status": "APPROVED"
}
```

**Example Request** — Rejection
```json
{
  "status": "REJECTED",
  "rejectionReason": "Insufficient documentation — please attach receipts."
}
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "message": "Voucher approved successfully.",
  "data": {
    "id": "v1b2c3d4-...",
    "voucherNumber": "EGL-VCH-1234567890",
    "status": "APPROVED",
    "authorizedById": "a1b2c3d4-...",
    "authorizedAt": "2026-06-02T10:30:00.000Z",
    "...": "..."
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Voucher status cannot be changed. It is already APPROVED." }` | Voucher is not in PENDING status |
| `400` | `{ "status": "error", "message": "Validation failed" }` | `status` is not APPROVED or REJECTED |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `voucher:update` permission |
| `404` | `{ "status": "error", "message": "Voucher not found." }` | Voucher doesn't exist |

---

### 6. Mark Voucher as Paid (NEW)

```
PATCH /api/vouchers/:id/pay
```

Requires `voucher:pay` permission. Marks an **approved** voucher as paid with evidence of disbursement. This is a terminal action — once paid, the status cannot be changed. Automatically creates a cashbook entry (CREDIT) recording the actual cash outflow.

**Headers**
```
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

**Path Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Voucher ID (UUID v4) |

**Request Body Fields**
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `paymentMethod` | string | **Yes** | Non-empty | How the payment was made: `"bank_transfer"`, `"cash"`, `"check"`, etc. |
| `paymentReference` | string | No | — | Bank reference number, teller number, check number, or transaction ID |
| `paymentNotes` | string | No | — | Any additional notes about the disbursement |
| `paidBySignatureUrl` | string | No | — | Pre-existing signature URL of the confirming officer |

**Upload Fields** (multipart — each max 1 file)
| Field | Description |
|-------|-------------|
| `paymentEvidence` | Screenshot, bank teller receipt, transfer confirmation, or any proof of payment (stored on S3) |
| `paidBySignature` | Signature file of the officer confirming disbursement |

> If no signature file is uploaded, the system falls back to the confirming officer's pre-configured `signatureUrl`.

**Example Request** (JSON — no files)
```json
{
  "paymentMethod": "bank_transfer",
  "paymentReference": "TRF-20260602-001234",
  "paymentNotes": "Transferred to beneficiary's GT Bank account"
}
```

**Example Request** — Multipart (with payment evidence)
```
Fields:
  paymentMethod: bank_transfer
  paymentReference: NIP-20260602-987654
  paymentNotes: Instant transfer via NIBSS

Files:
  paymentEvidence: transfer-receipt.png
  paidBySignature: finance-officer-signature.png
```

**Success Response** — `200 OK`
```json
{
  "status": "success",
  "message": "Voucher marked as paid successfully.",
  "data": {
    "id": "v1b2c3d4-...",
    "voucherNumber": "EGL-VCH-1234567890",
    "voucherType": "PAYMENT_AUTHORITY",
    "date": "2026-06-01",
    "purpose": "Vendor payment — Lagos supplies",
    "amount": "250000.00",
    "status": "PAID",
    "beneficiaryName": "Acme Supplies Ltd",
    "authorizedBy": { "id": "uuid", "firstName": "Admin", "lastName": "User" },
    "authorizedAt": "2026-06-01T14:30:00.000Z",
    "paidBy": { "id": "uuid", "firstName": "Finance", "lastName": "Officer" },
    "paidAt": "2026-06-02T11:00:00.000Z",
    "paidBySignatureUrl": "https://...",
    "paymentEvidenceUrl": "https://...",
    "paymentMethod": "bank_transfer",
    "paymentReference": "TRF-20260602-001234",
    "paymentNotes": "Transferred to beneficiary's GT Bank account",
    "createdBy": { "id": "uuid", "firstName": "Jane", "lastName": "Doe" },
    "createdAt": "2026-06-01T08:00:00.000Z",
    "updatedAt": "2026-06-02T11:00:00.000Z"
  }
}
```

**Error Responses**
| Status | Body | When |
|--------|------|------|
| `400` | `{ "status": "error", "message": "Only approved vouchers can be marked as paid. This voucher is currently PENDING." }` | Voucher is not in APPROVED status |
| `400` | `{ "status": "error", "message": "Only approved vouchers can be marked as paid. This voucher is currently PAID." }` | Voucher was already marked as paid |
| `400` | `{ "status": "error", "message": "Validation failed", "errors": { "body": { "paymentMethod": "Payment method is required" } } }` | Missing `paymentMethod` |
| `401` | `{ "status": "error", "message": "Authentication required." }` | Missing or expired JWT |
| `403` | `{ "status": "error", "message": "Access Denied..." }` | User lacks `voucher:pay` permission |
| `404` | `{ "status": "error", "message": "Voucher not found." }` | Voucher doesn't exist |
| `500` | `{ "status": "error", "message": "Error marking voucher as paid." }` | Database or S3 error |

### Side Effects of Marking as Paid

When a voucher is marked as paid, two additional records are created automatically:

**1. Cashbook Entry** — A CREDIT entry is created in the cashbook linked to the voucher:
- `natureOfTransaction`: `BANK` if `paymentMethod` contains "bank" or "transfer", otherwise `CASH`
- `entryType`: `CREDIT` (money has left the account)
- `amount`: same as the voucher amount
- `voucherId`: links back to the voucher for traceability
- `description`: auto-generated, e.g. "Payment for voucher EGL-VCH-xxx — bank_transfer"

**2. Audit Log Entry** — An immutable audit record is written:
- `entityType`: `"FinanceVoucher"`
- `action`: `"voucher_paid"`
- `actionDetails`: includes `voucherNumber`, `amount`, `paymentMethod`, and `paymentReference`

### Paid Fields Reference

Every voucher returned by GET endpoints includes these payment-related fields (null unless the voucher has been marked as paid):

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `"PAID"` once confirmed |
| `paidAt` | ISO 8601 \| null | When payment was confirmed |
| `paidBy` | object \| null | Sanitized user who confirmed the payment |
| `paidBySignatureUrl` | string \| null | Presigned URL for the confirming officer's signature |
| `paymentEvidenceUrl` | string \| null | Presigned URL for uploaded proof of payment (bank teller, transfer receipt, screenshot) |
| `paymentMethod` | string \| null | e.g. `"bank_transfer"`, `"cash"`, `"check"` |
| `paymentReference` | string \| null | Bank reference number, teller number, check number |
| `paymentNotes` | string \| null | Any additional notes about the disbursement |

### Permission: `voucher:pay`

The `voucher:pay` permission is separate from `voucher:update` (which handles approval/rejection). This allows organizations to assign payment confirmation to a dedicated finance/treasury role while approval authority stays with managers.

- **Seeded scopes:** `DEPARTMENT` and `ALL`
- **Who should have it:** Finance officers, treasury staff, accountants — roles responsible for verifying that funds were actually disbursed
- **Fast-path whitelist:** Not included — must be explicitly granted via role assignments

### Voucher Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `voucherNumber` | string | Unique auto-generated number (`EGL-VCH-...`) |
| `voucherType` | `REQUEST_FOR_CASH` \| `PAYMENT_AUTHORITY` \| `CASH_PAYMENT_VOUCHER` | Type of voucher |
| `date` | string | Voucher date (`YYYY-MM-DD`) |
| `purpose` | string \| null | Purpose of the voucher |
| `amount` | string | Amount (decimal returned as string for precision) |
| `totalAmount` | string \| null | Total amount |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `PAID` | Current status |
| `receiptUrl` | string \| null | Presigned URL for general receipt/attachment |
| `staff` | object \| null | Staff member (Request for Cash) |
| `staffSignatureUrl` | string \| null | Staff signature URL |
| `beneficiaryName` | string \| null | Beneficiary name (Payment Authority) |
| `bankTransferDate` | string \| null | Bank transfer date (Payment Authority) |
| `particulars` | array \| null | Line items (Cash Payment Voucher) |
| `receivedBy` | object \| null | Who received the cash |
| `issuedBy` | object \| null | Who issued the cash |
| `authorizedBy` | object \| null | Who approved/rejected the voucher |
| `authorizedAt` | ISO 8601 \| null | When the voucher was approved or rejected |
| `rejectionReason` | string \| null | Why the voucher was rejected |
| `paidBy` | object \| null | Who confirmed payment (PAID vouchers only) |
| `paidAt` | ISO 8601 \| null | When payment was confirmed |
| `paymentMethod` | string \| null | Method used for disbursement |
| `paymentReference` | string \| null | Reference number for the payment |
| `paymentEvidenceUrl` | string \| null | Presigned URL for uploaded payment proof |
| `paymentNotes` | string \| null | Notes about the disbursement |
| `createdBy` | object | User who created the voucher (sanitized) |
| `createdAt` | ISO 8601 | Creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

### Audit Trail

Every voucher mutation writes to the system audit log with:
- `entityType`: `"FinanceVoucher"`
- `entityId`: the voucher's UUID
- `action`: `CREATE` (created), `UPDATE` (approved), `DELETE` (rejected), or `voucher_paid` (marked as paid)
- `actionDetails`: includes `voucherNumber`, `amount`, `paymentMethod`, `paymentReference` where applicable
- `performedBy`: the authenticated user's ID
- `ipAddress` and `userAgent`: from the request

Use `GET /api/audit?entityType=FinanceVoucher` (with `audit:read` permission) to inspect the full history of voucher changes.

---

## Project Structure

```
src/
├── server.ts                  # Express app entry point
├── socket.ts                  # Socket.IO setup with JWT auth
├── middleware/
│   ├── auth.middleware.ts     # JWT verification + role guards
│   ├── authorize.middleware.ts # ABAC permission enforcement
│   ├── validate.middleware.ts # Zod request validation
│   ├── response-standardizer.ts
│   └── upload.middleware.ts   # Multer file uploads
├── modules/
│   ├── auth/                  # Authentication
│   ├── users/                 # User management
│   ├── roles/                 # Departmental roles
│   ├── permissions/           # Permission definitions
│   ├── departments/           # Departments
│   ├── shipments/             # Shipment tracking
│   ├── financial/             # Payments, invoices, vouchers, cashbook, ledger
│   ├── documents/             # Document management
│   ├── warehouse/              # Inbound/outbound warehouse entries
│   ├── workflow/              # Workflow automation
│   ├── audit/                 # Immutable audit log
│   ├── messages/              # Internal messaging + channels
│   ├── notifications/         # Email + in-app notifications
│   ├── customers/             # Customer records
│   ├── search/                # Full-text search
│   └── reports/               # Reporting
├── utils/
│   ├── permission-calculator.ts  # Computes permission maps for frontend
│   ├── serializers.ts         # Response sanitization
│   ├── validators.ts          # Zod schemas
│   ├── helpers.ts             # Pagination, ID generation
│   ├── cache.ts               # NodeCache + permission cache helpers
│   └── storage.service.ts     # Backblaze B2 file storage
├── scripts/
│   └── seed-permissions.ts    # Auto-seeds resource:action permission pairs
└── jobs/                      # Cron jobs (keep-alive, overdue invoices)
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npm run typeorm` | Run TypeORM CLI commands |
| `npm run migration:generate` | Generate a new migration |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert last migration |

## License

Proprietary — EagleNet Logistics.

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
| `voucher` | `create`, `read`, `update`, `delete`, `verify`, `approve` |
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

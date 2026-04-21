# Eaglenet Backend - System Specification Document

## Project Overview
Eaglenet is an enterprise internal logistics management and auditing system designed for tracking internal shipments, managing departments, staff coordination, and comprehensive audit logging with real-time messaging. The system is exclusively for internal staff use with full audit trail of all actions.

---

## PHASE 1: Core Infrastructure & Foundation

### Phase 1.1: Database Schema & Entities
**Purpose**: Establish the foundational data structures for the entire system

#### Key Entities to Define:
1. **User Entity**
   - `id` (UUID, primary key)
   - `firstName`, `lastName`
   - `email` (unique, company email)
   - `phoneNumber`
   - `password` (hashed with bcrypt)
   - `department` (foreign key to Department)
   - `role` (foreign key to Role)
   - `status` (active/inactive)
   - `createdAt`, `updatedAt`
   - `lastLogin` (timestamp)
   - `lastLoginIp` (for security tracking)

2. **Role Entity**
   - `id` (UUID, primary key)
   - `name` (e.g., SuperAdmin, Admin, StaffMember, DepartmentManager)
   - `permissions` (JSON array or separate permissions table)
   - `createdAt`, `updatedAt`
   - `createdBy` (foreign key to User)

3. **Department Entity**
   - `id` (UUID, primary key)
   - `name`
   - `supervisor` (foreign key to User)
   - `email` (department email)
   - `status` (active/inactive)
   - `totalStaff` (denormalized count for performance)
   - `createdAt`, `updatedAt`
   - `createdBy` (foreign key to User)

4. **Shipment Entity**
   - `id` (UUID, primary key)
   - `shipmentId` (human-readable tracking number)
   - `shipmentName` (internal description/reference)
   - `type` (export/import - enum)
   - `status` (pending/in-transit/customs/delivered - enum)
   - `pickupAddress`
   - `deliveryAddress`
   - `weight` (in kg)
   - `dimensions` (JSON: {length, width, height})
   - `origin` (location code)
   - `destination` (location code)
   - `departmentId` (foreign key to Department - originating department)
   - `createdBy` (foreign key to User - staff member who created shipment)
   - `assignedTo` (foreign key to User - assigned delivery/handling staff)
   - `createdAt`, `updatedAt`
   - `expectedDeliveryDate`
   - `actualDeliveryDate`
   - `internalNotes` (notes for internal use only)

5. **ShipmentTracking Entity** (Historical tracking records)
   - `id` (UUID, primary key)
   - `shipmentId` (foreign key to Shipment)
   - `status` (created/in-transit/customs-clearance/delivered)
   - `timestamp` (when status changed)
   - `location` (where it is)
   - `notes`
   - `updatedBy` (foreign key to User)

6. **Document Entity**
   - `id` (UUID, primary key)
   - `shipmentId` (foreign key to Shipment)
   - `title`
   - `description`
   - `fileName`
   - `fileUrl` (S3 or storage path)
   - `fileType` (pdf/image - enum)
   - `fileSize`
   - `uploadedBy` (foreign key to User)
   - `uploadedAt`
   - `metadata` (JSON: additional info)

7. **DocumentActivity Entity** (Audit logging for documents)
   - `id` (UUID, primary key)
   - `documentId` (foreign key to Document)
   - `action` (viewed/downloaded/shared - enum)
   - `performedBy` (foreign key to User)
   - `performedAt`
   - `ipAddress`

8. **Payment Entity**
   - `id` (UUID, primary key)
   - `shipmentId` (foreign key to Shipment)
   - `amount`
   - `currency`
   - `paymentMethod` (enum: transfer, cash, card)
   - `status` (pending/confirmed/failed - enum)
   - `reference` (transaction reference)
   - `processedAt`
   - `processedBy` (foreign key to User)

9. **Message Entity** (For real-time messaging)
   - `id` (UUID, primary key)
   - `senderId` (foreign key to User)
   - `recipientId` (foreign key to User)
   - `threadId` (to group conversations)
   - `content`
   - `messageType` (text/file - enum)
   - `attachmentUrl` (if applicable)
   - `sentAt`
   - `readAt` (nullable)
   - `isDeleted` (soft delete flag)

10. **AuditLog Entity** (Core internal auditing - cannot be deleted, append-only)
    - `id` (UUID, primary key)
    - `entityType` (Shipment, User, Department, Document, Payment, etc.)
    - `entityId` (UUID of the entity)
    - `action` (create/update/delete/view/download/share - enum)
    - `actionDetails` (JSON: what changed, field-level tracking)
    - `performedBy` (foreign key to User)
    - `performedAt` (timestamp)
    - `ipAddress` (for security tracking)
    - `userAgent` (browser/client info)
    - `departmentId` (for departmental audit filtering)
    - `reason` (optional: why the action was taken)

11. **EmailLog Entity** (Internal email tracking)
    - `id` (UUID, primary key)
    - `recipientEmail` (internal staff email)
    - `recipientName`
    - `senderEmail` (who sent it)
    - `subject`
    - `template` (name of template used)
    - `status` (sent/failed/bounced - enum)
    - `shipmentId` (foreign key to Shipment - nullable)
    - `sentAt`
    - `failureReason` (if status is failed)
    - `sentBy` (foreign key to User - who triggered the email)

12. **Notification Entity**
    - `id` (UUID, primary key)
    - `userId` (foreign key to User)
    - `title`
    - `message`
    - `type` (status-update/system/alert - enum)
    - `relatedEntityType` (Shipment, Department, etc.)
    - `relatedEntityId`
    - `isRead`
    - `createdAt`
    - `readAt` (nullable)

### Phase 1.2: Authentication & Authorization
**Purpose**: Establish secure user authentication and role-based access control

#### Requirements:
- JWT-based authentication with access & refresh tokens
- Password hashing (bcrypt)
- Role-based access control (RBAC)
- Department-based access filtering
- Permission inheritance based on roles
- Login audit logging
- Session management with token expiration

#### Consideration Points:
- SuperAdmin role has no departmental restrictions, can see all data and audit logs
- Department staff only see data from their own department by default
- Department managers can see staff and shipment data for their department
- All authentication attempts logged (success and failure)
- All access to sensitive data logged (who viewed what, when, from where)

---

## PHASE 2: Dashboard & Analytics

### Phase 2.1: Main Dashboard
**Purpose**: Provide executive overview of system operations

#### Dashboard Metrics (Real-time aggregations):
1. **Key Performance Indicators**
   - Total Shipments (all-time count, filtered by department if not SuperAdmin)
   - Export Shipments (count filtered by type=export)
   - Import Shipments (count filtered by type=import)
   - Pending Deliveries (count of shipments with status=pending)
   - Active Staff (count of active users in department or system)

2. **Quick Statistics Cards**
   - In-Transit (count of status=in-transit)
   - Pending (count of status=pending)
   - Customs (count of shipments with customs status)
   - Delivered (count of status=delivered)
   - Completed Deliveries (additional context metric)

3. **Recent Activities Feed**
   - Display last 10-20 significant audit-logged actions
   - Fields per activity:
     - `activityTitle` (e.g., "Shipment Created", "Status Updated", "Document Uploaded")
     - `performedBy` (user name + department)
     - `timestamp` (relative: "8 hours ago")
     - `activityType` (shipment/document/user/payment - for icon/color coding)
     - `entityRef` (which shipment/document affected)
   - Only show activities user has permission to view (based on department if not SuperAdmin)

4. **Recent Shipments Table**
   - Display last 15-20 created shipments
   - Columns: ShipmentID, Shipment Name, Type, Status, Destination, Created By, Department
   - Quick action: Click row to view details
   - Filter by department (if user is not SuperAdmin)
   - Show only shipments relevant to user's department

#### Performance Considerations:
- Cache metrics with 5-minute TTL to prevent excessive DB queries
- Use database aggregation queries (COUNT, SUM) instead of loading all records
- Implement indexed queries on `status`, `createdAt`, `type` fields
- For recent activities: Use pagination or limit to last N records

### Phase 2.2: Activity Logging Service
**Purpose**: Track all user actions for auditing and analytics

#### What to Log (Internal Auditing):
- User login/logout (success and failures)
- Shipment CRUD operations (create/read/update/delete)
- Document uploads/downloads/views/shares
- Status changes in shipments with who changed it and when
- Payment processing and status updates
- User/Department management (creation, role changes, deactivation)
- Permission changes
- Email/Message actions (who sent to whom, when)
- Access to sensitive data
- Mass operations (bulk updates, batch deletes)

#### Log Structure:
```
{
  action: string,
  entityType: string,
  entityId: UUID,
  changes: {
    before: object,
    after: object
  },
  performedBy: UUID,
  performedAt: timestamp,
  ipAddress: string,
  departmentId: UUID,
  metadata: object
}
```

#### Implementation Notes:
- Use middleware to intercept all route changes
- Async logging (don't block main request)
- Separate table for performance
- Archive old logs after 6 months

---

## PHASE 3: Department Management

### Phase 3.1: Department Dashboard
**Purpose**: Manage departments and view department-level statistics

#### Dashboard Displays:
1. **Department Summary Cards**
   - Total Departments (count)
   - Average Staff Count (aggregate)
   - Total Shipments (department-level)
   - Pending Deliveries (department-level)

2. **Department List Table**
   - Columns: 
     - Department Name
     - Supervisor Name
     - Email
     - Staff Count
     - Active Shipments Count
     - Status (active/inactive)
     - Created Date
   - Actions: View Details, Edit, Delete (SuperAdmin only)
   - Pagination: 10-20 rows per page

### Phase 3.2: Create Department
**Purpose**: Onboard new departments into the system

#### Required Fields:
- `departmentName` (required, must be unique)
- `supervisor` (required, select from existing users)
- `email` (required, must be unique)
- `status` (default: active)

#### Business Logic:
- Only SuperAdmin can create departments
- Supervisor must exist in system
- Email validation (must be company domain)
- Automatically log this action

### Phase 3.3: Individual Department View
**Purpose**: Manage a specific department and its staff

#### Information Displayed:
1. **Department Header Info**
   - Department Name
   - Supervisor Name & Contact
   - Total Staff Count
   - Total Shipments
   - Pending Deliveries

2. **Staff List (Paginated)**
   - Columns:
     - Full Name
     - Email Address
     - Phone Number
     - Role (e.g., Manager, Coordinator, Staff)
     - Active Shipments (count assigned)
     - Created Date
   - Actions: View Profile, Edit, Deactivate, View More
   - Sorting: By name, creation date, active shipments

3. **Department Statistics**
   - Shipment breakdown by status
   - Staff activity heatmap (who's most active)
   - Average delivery time
   - Performance metrics

### Phase 3.4: Create Staff
**Purpose**: Add new staff members to departments

#### Required Fields:
- `firstName`
- `lastName`
- `email` (unique)
- `phoneNumber`
- `department` (auto-populated if accessed from department page)
- `role` (dropdown: must be created by SuperAdmin)
- `status` (default: active)

#### Role Assignment:
- SuperAdmin defines available roles first
- Each role has specific permissions
- Roles determine what actions a staff member can perform
- Multiple staff can have the same role

#### Business Logic:
- Email must be unique in system
- Department must exist
- Log creation with creator's info
- Generate temporary password or send invitation link

### Phase 3.5: Staff Profile / View More
**Purpose**: Display comprehensive staff information

#### Information:
- Full Name, Email, Phone
- Department & Supervisor
- Role & Permissions List
- Active Shipments (with status breakdown)
- Created Date
- Last Active (timestamp)
- Activity Log (last 20 actions by this staff)
- Documents they've uploaded
- Edit Profile, Change Role, Reset Password, Deactivate

---

## PHASE 4: Shipment Management

### Phase 4.1: Shipment Creation / Booking
**Purpose**: Create new internal shipments with all required documentation

#### Required Fields:
1. **Shipment Reference Information**
   - `shipmentName` (internal reference/description) - Required
   - `internalReference` (optional code for internal tracking)

2. **Shipment Details**
   - `type` (enum: export or import) - Required
   - `pickupAddress` - Required
   - `deliveryAddress` - Required
   - `weight` (in kg) - Required
   - `dimensions` (L x W x H in cm) - Required
   - `internalNotes` (optional notes for staff)

3. **Documentation**
   - `documentTitle` - Required
   - `documentDescription` - Optional
   - `fileUpload` (multiple files allowed)
     - Accepted formats: PDF, JPG, PNG, GIF
     - Max file size: 10MB per file
     - Max 5 files per shipment

4. **Department Assignment & Staff**
   - If creator is regular staff: Auto-assigned to their department
   - If creator is SuperAdmin: Must select target department (required field)
   - Can specify initial assigned staff member (for delivery/handling)

#### Business Logic:
- Generate unique shipmentId (internal tracking number)
- Set initial status: "pending"
- Create ShipmentTracking record with status=created
- Log creation action to AuditLog (who created, when, from where)
- Send in-app notification to assigned department supervisor
- Send email notification to assigned department supervisor and assigned staff
- Store all documents with metadata and audit trail

#### Validations:
- Shipment name cannot be empty
- Weight must be positive number (> 0)
- Dimensions must be positive numbers
- At least one document must be uploaded
- Addresses should be validated for format
- Department must exist and be active
- Creator must be active staff member in the department

### Phase 4.2: Shipment Dashboard
**Purpose**: Provide shipment-level statistics and overview

#### Metrics Displayed:
- Total Shipments (in system)
- In-Transit (count)
- Pending (count)
- Delivered (count)
- Pending Deliveries (count of pending status)
- Customs Clearance (count of shipments in customs status)

#### Calculations:
- All metrics filtered by user's department (unless SuperAdmin)
- Metrics updated in real-time or cached with 5-min TTL

### Phase 4.3: Shipment List
**Purpose**: Display searchable list of all shipments

#### Table Columns:
- Shipment ID (clickable - opens details)
- Customer Name
- Type (export/import)
- Status (color-coded badge)
- Origin
- Destination
- Created Date

#### Features:
- Pagination: 20 rows per page
- Filters: 
  - By Status (multi-select)
  - By Type (export/import)
  - By Date Range
  - By Department (SuperAdmin only)
- Sort: By shipment ID, customer name, date, status
- Search: By shipment ID or customer name

#### Permissions:
- Regular staff see only their department's shipments and relevant staff
- Department managers see all shipments and staff in their department
- SuperAdmin sees all shipments, all staff, all audit logs

### Phase 4.4: Shipment Detail View
**Purpose**: Display comprehensive shipment information and operations

#### Sections:

1. **Shipment Header**
   - Shipment ID & Status (large, prominent)
   - Tags: [Type (export/import), Status, Creation Source]

2. **Shipment Reference Information**
   - Shipment Name/Description
   - Internal Reference Code (if applicable)
   - Originating Department

3. **Route Information**
   - From (pickup address)
   - To (delivery address)
   - Map visualization (optional enhancement)
   - Origin & Destination codes

4. **Shipment Overview** (collapsed/expandable)
   - Shipment ID
   - Tracking Number (if different from ID)
   - Weight (kg)
   - Dimensions (L x W x H)
   - Created By (user name)
   - Creation Date
   - Expected Delivery Date
   - Assigned Department

5. **Tracking Timeline** (Visual or List format)
   Each entry contains:
   - Status: Created, In Transit, Customs Clearance, Delivered
   - Date & Time of status change
   - Location (where it currently is)
   - Updated By (staff member)
   - Notes (any comments about this stage)
   
   Example:
   ```
   ✓ Created - 2026-04-01 10:30 AM - Warehouse A - (Created by John Doe)
   → In Transit - 2026-04-02 2:15 PM - En route to customs - (Updated by Staff)
   → Customs Clearance - 2026-04-03 9:00 AM - Customs Terminal - (Updated by Customs Officer)
   ○ Delivered - [pending] - Destination - [pending]
   ```

6. **Documents Section** (Tab)
   - Table with columns:
     - Document Name
     - Upload Date
     - Uploaded By
     - File Type
     - Actions: View, Download, Share
   - Every document access logged

7. **Payment Section** (Tab)
   - Payment Status
   - Amount & Currency
   - Payment Method
   - Transaction Reference
   - Processed Date
   - Processed By
   - Actions: View Receipt, Update Status (if pending)

8. **Delivery Proof Section** (Tab)
   - Fields for delivery staff to upload:
     - Signature (image)
     - Delivery Photo
     - Recipient Name
     - Delivery Notes
   - These uploads generate audit logs

9. **Activity Log** (Tab)
   - Chronological list of all actions on this shipment
   - Fields: Action, Performed By, Timestamp, Details

#### Update Operations:
- Only authorized staff can update shipments
- Status changes create ShipmentTracking records
- All updates logged in AuditLog
- Notifications sent to relevant parties on major updates

---

## PHASE 5: Document Management

### Phase 5.1: Document Upload & Storage
**Purpose**: Securely store and manage shipment documents

#### Requirements:
- Multiple file uploads per shipment
- File type validation (PDF, JPG, PNG, GIF)
- File size limits (10MB per file, 50MB per shipment)
- Store files in secure location (S3, Minio, or local encrypted storage)
- Generate unique file identifiers
- Track upload metadata:
  - Uploader (User ID)
  - Upload timestamp
  - Original filename
  - File size
  - File type
  - Virus scan status (if applicable)

### Phase 5.2: Document Access Control
**Purpose**: Control who can view/download documents

#### Rules:
- Only authorized department staff can access department documents
- SuperAdmin can access all documents
- Customers can access their own shipment documents
- Every access logged in DocumentActivity

#### Audit Logging:
- Track document views
- Track document downloads
- Track document shares
- Record IP address and user agent
- Timestamp all actions

### Phase 5.3: Text Extraction Service
**Purpose**: Extract searchable text from documents

#### Functionality:
- Extract text from PDF files
- Store extracted text for search indexing
- Enable full-text search on shipment documents
- Identify key information (dates, amounts, addresses)

#### Implementation:
- Use PDF parsing library (pdfjs, or similar)
- Run asynchronously after upload
- Store extracted text in database

---

## PHASE 6: Messaging & Communication

### Phase 6.1: Real-Time Messaging
**Purpose**: Enable staff-to-staff real-time communication

#### Features:
1. **Message Thread**
   - One-to-one conversations between staff
   - Display sender and recipient
   - Show message timestamps
   - Mark as read/unread

2. **Message Content**
   - Text messages
   - File attachments (documents, images)
   - Timestamp relative display ("5 minutes ago")

3. **Real-Time Updates**
   - Use WebSockets (Socket.io integration already exists)
   - New messages appear instantly
   - Typing indicators (optional)
   - Online/offline status

4. **Notification**
   - Notify recipient when new message arrives
   - Unread message badge
   - @mentions could trigger priority notifications

#### Database:
- Message entity as defined in Phase 1.1
- Message thread grouping logic
- Soft delete support (users can delete conversations)

### Phase 6.2: Email Notification System
**Purpose**: Send automated and manual emails to internal staff

#### Email Types:

1. **Automated Emails**
   - Welcome email (new staff member)
   - Password reset email
   - Shipment status update emails (created, in-transit, customs, delivered)
   - Payment confirmation emails
   - Document upload notifications
   - Assignment notifications (staff assigned to shipment)
   - System alerts and audit notifications

2. **Manual Emails**
   - Staff can compose and send to internal stakeholders
   - Email composition fields:
     - `recipient` (internal staff email address)
     - `subject`
     - `message` (body text)
     - `template` (select predefined template or custom)
     - `shipmentId` (optional, attach shipment reference)
   - Attachments support
   - Logged in EmailLog with sender tracking

#### Email Templates
**Location**: `/src/templates/emails/`

Predefined templates:
1. `welcome.hbs` - New user welcome
2. `password-reset.hbs` - Password reset instructions
3. `notification.hbs` - General notifications
4. `ticket.hbs` - Support ticket notifications
5. `permissions.hbs` - Permission change notifications
6. Custom templates for shipment status updates:
   - Shipment created
   - In transit
   - Customs clearance
   - Delivered

**Template Structure**:
```handlebars
<h1>Subject</h1>
<p>Dear {{customerName}},</p>
<p>{{mainContent}}</p>
<p>Shipment ID: {{shipmentId}}</p>
<p>Status: {{status}}</p>
<p>Best regards,<br/>Eaglenet Team</p>
```

#### Email Service Requirements:
- Use SMTP or email service provider (SendGrid, Mailgun, etc.)
- Track all sent emails in EmailLog with sender tracking
- Log failures and retry logic (retry up to 3 times)
- Template variable interpolation
- Batch sending for multiple recipients (optional)
- Audit trail: log who sent email, to whom, about what, when
- All email content stored for audit purposes
- Email delivery tracking (opened, clicked - if supported)

---

## PHASE 7: Payments & Invoicing

### Phase 7.1: Payment Management
**Purpose**: Handle shipment payments and track payment status

#### Payment Entity Fields:
- Shipment reference
- Amount & currency
- Payment method (transfer, cash, card - enum)
- Status (pending, confirmed, failed - enum)
- Transaction reference (for verification)
- Processing timestamp
- Processed by (staff member)
- Notes

#### Payment Operations:
- Create payment entry when shipment is created or on-demand
- Update payment status (pending → confirmed/failed)
- Record payment proof/receipt
- Reconciliation with bank transfers (manual or automated)

#### Audit:
- All payment changes logged
- Who changed the status and when
- Payment history preserved

### Phase 7.2: Invoice Generation
**Purpose**: Generate invoices for internal shipments

#### Invoice Information:
- Invoice ID (unique)
- Shipment ID reference
- Internal shipment details
- Itemized charges:
  - Base shipping fee
  - Customs fees
  - Documentation fees
  - Taxes/VAT (if applicable)
- Total amount
- Payment method
- Due date
- Invoice date
- Status (draft, issued, paid, overdue)

#### Operations:
- Generate invoice PDF
- Email invoice to internal stakeholders
- Track invoice payment status
- Support for discounts/credits

---

## PHASE 8: Audit & Logging

### Phase 8.1: Comprehensive Internal Audit Trail
**Purpose**: Maintain detailed, immutable audit logs for internal compliance, security, and accountability

#### Audit Log Schema (as defined in Phase 1.1):
```
{
  id: UUID,
  entityType: string (Shipment/User/Department/Document/Payment/Message),
  entityId: UUID,
  action: enum (create/read/update/delete/view/download/send),
  actionDetails: {
    fieldChanged: string,
    oldValue: any,
    newValue: any,
    ... (varies by action type)
  },
  performedBy: UUID (User),
  performedAt: timestamp,
  ipAddress: string,
  userAgent: string,
  departmentId: UUID (for filtering),
  sessionId: string (optional, for session tracking)
}
```

#### What to Log (All actions immutable and append-only):
- **User Actions**
  - Login/logout attempts (success & failure) with IP address
  - Password changes (who changed it, when)
  - Profile updates (what changed)
  - Permission/role changes (who changed it, from what to what)
  - Account activation/deactivation

- **Shipment Actions**
  - Create shipment (creator, department, timestamp)
  - Update shipment status (who changed, from what to what, when, from where)
  - Modify shipment details (field-level tracking of changes)
  - Delete shipment (who deleted, when, from where)
  - Assign staff to shipment (who assigned, which staff, when)

- **Document Actions**
  - Upload document (who, when, size, type)
  - View document (who viewed, when, from where, for how long)
  - Download document (who, when, from where)
  - Share document (who shared to whom, when)
  - Delete document (who, when, from where)

- **Financial Actions**
  - Create payment (who created, amount, method, when)
  - Update payment status (who changed, from what to what, when)
  - Process refund (who processed, amount, when)
  - Payment reconciliation (who reconciled, which payments, when)

- **Administrative Actions**
  - Create user (who created, email, role, department, when)
  - Create department (who created, name, supervisor, when)
  - Assign role (who assigned, to whom, which role, when)
  - Change permissions (who changed, for whom, what changed, when)
  - User deactivation (who deactivated, which user, reason, when)

- **Access & Security Actions**
  - Failed login attempts (email, IP, timestamp)
  - Bulk operations (export, bulk update, what was changed)
  - Access to audit logs (who accessed, which logs, when)
  - Permission checks (who tried to access what, allowed or denied)

### Phase 8.2: Audit Report/View
**Purpose**: Allow authorized personnel to review audit logs

#### Audit Log Display:
- Filterable table with columns:
  - Entity Type
  - Entity ID (clickable to entity)
  - Action
  - Performed By (user name)
  - Timestamp
  - Department
  - IP Address (optional)

#### Filters:
- Date range (from/to dates)
- Entity type (Shipment, User, Document, Payment, etc.)
- Action type (create, update, delete, view, download)
- User/Department (who performed action, which department affected)
- Search by entity ID (find all actions on specific shipment/document)
- Action severity (high-risk actions, standard operations)
- IP address (track access from specific locations)

#### Restrictions & Permissions:
- SuperAdmin sees all audit logs (cannot hide any)
- Department managers see logs for their department's shipments, staff, and activities
- Regular staff can see logs related to:
  - Their own actions
  - Shipments they're assigned to
  - Their own documents
  - Their own login attempts
- Audit logs cannot be filtered or hidden by anyone
- Audit log deletion is prevented at database level (no CASCADE delete)
- Immutable: once created, audit logs cannot be modified or deleted

#### Performance & Retention:
- Paginate large result sets (default 50 per page)
- Index on performedAt, entityType, departmentId, performedBy for fast queries
- Archive old logs (12+ months) to separate archival table (still queryable)
- Keep hot logs (recent 6 months) in main table
- Retention policy: Keep all logs for minimum 3 years (compliance requirement)
- Implement read-only archive database for historical queries

### Phase 8.3: Activity Log Widget
**Purpose**: Display recent activities throughout system

#### Widget Shows:
- Last 10-20 significant actions
- Action type with icon
- Who performed it
- When (relative time: "2 hours ago")
- What entity it relates to
- Quick link to entity

#### Used In:
- Main dashboard
- Department dashboard
- Shipment detail page
- User profile page

---

## PHASE 9: Notifications

### Phase 9.1: Notification System Architecture
**Purpose**: Deliver timely notifications to relevant users

#### Notification Types:
1. **Status Update Notifications**
   - Shipment status changed (assigned staff and supervisor)
   - Payment status changed
   - Document uploaded

2. **System Notifications**
   - New message received (real-time)
   - Staff assignment to shipment
   - Role/permission change
   - Department assignment

3. **Alert Notifications**
   - Overdue delivery (supervisor of department)
   - Failed payment (finance staff)
   - System error/maintenance (all staff)
   - Unusual access patterns (SuperAdmin only)

4. **Audit Notifications**
   - High-risk actions performed (document deletion, status manipulation)
   - Multiple failed login attempts from user
   - Bulk operations performed
   - Data exported or accessed by non-owner

#### Notification Scope:
- User-specific: Only relevant notifications (assigned shipments, own actions, own department)
- Department-specific: Can be sent to all department members (supervisors)
- Role-specific: Can target users by role (all managers, all supervisors)
- SuperAdmin: Receives all notifications and audit alerts

### Phase 9.2: Notification Delivery Channels
**Purpose**: Ensure users receive notifications through appropriate channels

#### Channels:
1. **In-App Notifications**
   - Stored in Notification table
   - Displayed in UI notification center
   - Mark as read/unread
   - Delete old notifications

2. **Email Notifications**
   - For significant events (status changes, new assignments)
   - Template-based
   - Can be configured per user (notification preferences)

3. **Real-Time Notifications** (WebSocket)
   - Instant delivery of new messages
   - Status updates
   - Live updates on active pages

#### Notification Preferences:
- Users can configure notification settings (within limits)
- Enable/disable certain notification types (except critical audit alerts)
- Quiet hours (no notifications between X and Y)
- Email digest frequency (immediate, daily, weekly)
- Audit notifications for SuperAdmin cannot be disabled (compliance requirement)
- Department supervisors cannot disable shipment status notifications

---

## PHASE 10: Performance & Security Optimization

### Phase 10.1: Database Query Optimization
**Purpose**: Prevent N+1 query problems and optimize performance

#### N+1 Query Prevention:

1. **Eager Loading**
   - When loading shipments, eager load: customer, department, created-by-user, tracking records
   - When loading documents, eager load: uploaded-by-user
   - Example: 
   ```
   ShipmentRepository.find({
     relations: ['customer', 'department', 'createdBy', 'trackingRecords']
   })
   ```

2. **Batch Queries**
   - Instead of: `for each shipment { load payments }`
   - Use: `payments = PaymentRepository.find({where: {shipmentId: In([ids])}})`

3. **Query Result Caching**
   - Cache department list (invalidate on create/update/delete)
   - Cache role list (rarely changes)
   - Cache user permissions (cache with 1-hour TTL)

4. **Indexed Columns**
   - `shipments.departmentId`
   - `shipments.createdBy`
   - `shipments.status`
   - `shipments.createdAt`
   - `auditLog.performedAt`
   - `auditLog.entityType`
   - `auditLog.departmentId`
   - `documents.shipmentId`
   - `messages.senderId`, `recipientId`
   - `users.email`

5. **View/Materialized Views**
   - Create view for department statistics (staff count, shipment count)
   - Create view for shipment summary (counts by status)
   - Refresh these views on schedule or on change

6. **Pagination**
   - All list endpoints must support pagination
   - Default page size: 20
   - Max page size: 100
   - Cursor-based pagination for large datasets

#### Query Examples to Avoid:

```typescript
// ❌ BAD - N+1 query problem
const shipments = await Shipment.find();
for (const shipment of shipments) {
  shipment.customer = await Customer.findOne(shipment.customerId);
  shipment.tracking = await ShipmentTracking.find({shipmentId: shipment.id});
}

// ✅ GOOD - Single query with relations
const shipments = await Shipment.find({
  relations: ['customer', 'tracking'],
  skip: 0,
  take: 20
});
```

### Phase 10.2: Caching Strategy
**Purpose**: Reduce database load through intelligent caching

#### Cache Levels:

1. **Application Cache** (Redis recommended)
   - Department list (TTL: 1 hour)
   - Role list (TTL: 24 hours)
   - User permissions (TTL: 1 hour, invalidate on role change)
   - Dashboard metrics (TTL: 5 minutes)

2. **Query Result Caching**
   - Cache complex aggregations (with appropriate TTL)
   - Cache popular shipment queries
   - Implement cache invalidation on write

3. **HTTP Caching**
   - Set appropriate Cache-Control headers
   - Use ETags for GET endpoints
   - Browser caching for static assets

#### Cache Invalidation:
- Time-based expiration (TTL)
- Event-based invalidation (on create/update/delete)
- Manual invalidation endpoint for admin

### Phase 10.3: API Response Optimization
**Purpose**: Reduce network payload and improve response times

#### Techniques:
1. **Field Selection**
   - Allow clients to specify which fields to return (`?fields=id,name,status`)
   - Reduce response size for large datasets

2. **Pagination + Limiting**
   - Always paginate list endpoints
   - Return only necessary data per page
   - Include metadata: total count, page, pageSize

3. **Compression**
   - Enable GZIP compression on all responses
   - Compress JSON payloads

4. **Response Structure**
   ```json
   {
     "success": true,
     "data": [...],
     "pagination": {
       "page": 1,
       "pageSize": 20,
       "total": 150,
       "totalPages": 8
     },
     "timestamp": "2026-04-21T10:30:00Z"
   }
   ```

### Phase 10.4: Security Hardening
**Purpose**: Protect system from common vulnerabilities

#### Security Measures:

1. **Input Validation**
   - Validate all user inputs (type, length, format)
   - Sanitize inputs to prevent injection attacks
   - Use parameterized queries (already using TypeORM)

2. **Authorization**
   - Department-level access control
   - Role-based permissions
   - Resource ownership checks (can user access this shipment?)
   - Implement authorization middleware on all protected routes

3. **Data Encryption**
   - Encrypt sensitive fields (payment info, documents)
   - Use HTTPS for all communication
   - Hash passwords with bcrypt

4. **Rate Limiting**
   - Limit login attempts (prevent brute force)
   - Rate limit API endpoints (prevent DDoS)
   - Different limits for authenticated vs public endpoints

5. **CORS Configuration**
   - Only allow whitelisted origins
   - Restrict HTTP methods
   - No credentials for public endpoints

6. **Audit Trail**
   - All security-relevant actions logged (logins, permission changes, failed access attempts)
   - Log retention policy
   - Monitoring for suspicious patterns

7. **Session Management**
   - Secure session storage
   - CSRF token for state-changing operations
   - Session timeout (auto-logout after inactivity)
   - Invalidate sessions on logout

### Phase 10.5: Error Handling & Logging
**Purpose**: Maintain system reliability and debuggability

#### Error Handling:
- Consistent error response format
- Appropriate HTTP status codes
- Hide internal implementation details from clients
- Log full error stack traces server-side

#### Logging Strategy:
- Log levels: DEBUG, INFO, WARN, ERROR
- Log important operations (login, payment, shipment status change)
- Structured logging (JSON format for easy parsing)
- Log rotation (daily, with archive)
- Centralized logging (optional: ELK stack, Datadog)

---

## PHASE 11: Integration & Advanced Features

### Phase 11.1: WebSocket/Real-Time Updates
**Purpose**: Provide live updates without polling

#### Already Configured:
- Socket.io is already integrated in the project (`src/socket.ts`)

#### Use Cases:
1. **Messaging** - Real-time message delivery between staff
2. **Shipment Updates** - Live status changes visible to all stakeholders
3. **Notifications** - Instant notification delivery
4. **Online Status** - Show who's online/offline
5. **Typing Indicators** - Show when someone is typing

#### Implementation:
- Connect on user login
- Emit events for status changes, new messages
- Subscribe to relevant channels (department, shipment)
- Disconnect on logout

### Phase 11.2: Search Functionality
**Purpose**: Enable full-text search across shipments and documents

#### Searchable Fields:
- Shipment ID
- Customer name
- Document titles
- Document extracted text
- Shipment tracking notes

#### Search Types:
1. **Simple Search** - Search by shipment ID or customer name
2. **Full-Text Search** - Search document content (extracted text)
3. **Advanced Search** - Filter by multiple criteria (date, status, type, department)

#### Implementation:
- Database full-text search capability
- Index documents for faster search
- Implement search API endpoint with pagination
- Optional: Elasticsearch for advanced search capabilities

### Phase 11.3: Reporting & Analytics
**Purpose**: Generate insights from system data

#### Reports:
1. **Department Performance Report**
   - Staff productivity (shipments handled per person)
   - Average delivery time
   - Payment completion rate
   - Busiest periods

2. **Shipment Analytics**
   - Status breakdown (pie chart)
   - Type breakdown (export vs import)
   - Timeline trends (shipments created over time)
   - Route popularity

3. **Financial Report**
   - Revenue by department
   - Outstanding payments
   - Payment success rate

#### Features:
- Date range filtering
- Export to CSV/PDF
- Scheduled report generation & email delivery
- Visual charts and graphs

---

## PHASE 12: Deployment & Monitoring

### Phase 12.1: Environment Configuration
**Purpose**: Manage different environment settings

#### Environments:
- Development
- Staging
- Production

#### Configuration Management:
- Environment variables (.env files)
- Different database connections per environment
- API keys and secrets per environment
- Email service credentials
- Storage service credentials
- Log levels (DEBUG in dev, ERROR in prod)

### Phase 12.2: Monitoring & Alerting
**Purpose**: Detect and respond to issues proactively

#### Metrics to Monitor:
- API response time
- Error rate
- Database query performance
- Server resource usage (CPU, memory)
- Queue lengths (if using job queues)
- Active WebSocket connections

#### Alerting:
- Alert on high error rates
- Alert on slow queries
- Alert on server resource exhaustion
- Email notifications to admin

### Phase 12.3: Backup & Disaster Recovery
**Purpose**: Protect against data loss

#### Backup Strategy:
- Daily database backups
- Store backups in secure location (off-site)
- Regular restore drills
- Document recovery procedures

#### Disaster Recovery Plan:
- RTO (Recovery Time Objective)
- RPO (Recovery Point Objective)
- Failover procedures
- Communication plan

---

## Cross-Cutting Concerns (All Phases)

### 1. **Pagination Requirements**
- Implement on all list endpoints
- Default page size: 20 (configurable per endpoint)
- Maximum page size: 100
- Include total count and page metadata
- Support sorting on key fields
- Include hasMore flag for cursor-based pagination
- Pagination applied consistently across all departments (respect department filtering)

### 2. **Audit Logging Requirements** (CRITICAL)
- Every create/update/delete operation logged IMMEDIATELY
- Every view/download of sensitive data logged
- Include: who (user ID + name), what (entity type + ID), when (timestamp), where (IP + location), why (action + reason)
- Cannot be deleted (append-only logs enforced at database level)
- Cannot be modified (immutable records)
- Regular backup of audit logs (daily to off-site storage)
- Asynchronous logging (don't block main request)
- Comprehensive field-level logging for sensitive entities (Document, Payment, Shipment status)

### 3. **Department-Based Access Control** (Security Critical)
- SuperAdmin: Access to everything (all shipments, all audit logs, all staff, all departments)
- Department Managers: Access to department data only (staff, shipments, documents of their department)
- Department Staff: Access to assigned shipments/documents + their own department's shipments
- Staff cannot access other department's data (enforced at query level)
- All access attempts logged and audited
- Cross-department access denied and logged as security incident
- Fine-grained permissions: who can create/read/update/delete specific entities

### 4. **Data Validation**
- Email format validation (RFC 5322 compliant)
- Phone number format validation (country-specific)
- Address validation (required fields, format check)
- File type and size validation (whitelist allowed types)
- Weight and dimension validation (positive numbers, reasonable limits)
- Date validation (not in the past for delivery dates, reasonable future dates)
- Department/role validation (must exist in system)
- User email uniqueness (prevent duplicates)
- Shipment name/ID uniqueness (tracking number unique)

### 5. **Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "SHIPMENT_NOT_FOUND",
    "message": "Shipment with ID xxx not found",
    "details": {},
    "errorId": "err_12345" // for support/debugging
  },
  "timestamp": "2026-04-21T10:30:00Z"
}
```
- Errors logged to AuditLog for tracking
- 4xx errors: Invalid input by user
- 5xx errors: System errors (logged as alerts for SuperAdmin)
- Authorization errors (403): Logged as potential security incidents

### 6. **Success Response Format**
```json
{
  "success": true,
  "data": {},
  "auditId": "audit_12345", // optional: reference to audit log entry
  "timestamp": "2026-04-21T10:30:00Z"
}
```
- All successful operations reference their audit log entry
- Clients can use auditId to trace actions in audit trail

---

## Technology Stack Recommendations

### Backend:
- **Framework**: Express.js (already in use)
- **Database**: PostgreSQL (supports full-text search, JSONB)
- **ORM**: TypeORM (already in use)
- **Caching**: Redis
- **File Storage**: S3, Minio, or local encrypted storage
- **Email**: SendGrid or Mailgun
- **Real-Time**: Socket.io (already integrated)

### Frontend:
- **Framework**: React or Vue.js
- **State Management**: Redux or Pinia
- **Charts**: Chart.js or D3.js
- **Date/Time**: Day.js or Moment.js

### DevOps:
- **Containerization**: Docker
- **Orchestration**: Kubernetes (optional, for scaling)
- **CI/CD**: GitHub Actions, Jenkins, or GitLab CI
- **Monitoring**: Prometheus + Grafana or DataDog
- **Logging**: ELK Stack or Splunk

---

## Implementation Sequence Recommendation

1. **Phase 1** - Database schema & authentication with audit logging foundation (CRITICAL)
2. **Phase 8** - Comprehensive audit trails (implement early, affects all other phases)
3. **Phase 2** - Dashboard & activity logging
4. **Phase 3** - Department management with audit integration
5. **Phase 4** - Shipment management (core feature) with complete audit trail
6. **Phase 5** - Document management with full audit trail
7. **Phase 6** - Messaging & email notifications (internal staff only)
8. **Phase 7** - Payments & invoicing with audit logging
9. **Phase 9** - Notification system (uses components from phases 6-8)
10. **Phase 10** - Performance optimization & security hardening (ongoing throughout)
11. **Phase 11** - Advanced features (search, reporting, real-time, audit analysis)
12. **Phase 12** - Deployment & monitoring setup

Note: Phase 8 (Audit) should run in parallel with Phase 1, as audit logging is foundational to every other feature.

---

## Key Considerations

1. **Audit Trail Integrity** (CRITICAL): Ensure audit trails are:
   - Immutable (cannot be modified or deleted)
   - Comprehensive (all actions logged)
   - Tamper-proof (detect any modifications)
   - Retained per compliance requirements (3+ years minimum)
   - Easily queryable for investigations

2. **Compliance**: 
   - Meet regulatory requirements for data retention
   - Non-repudiation: users cannot deny their actions
   - Audit logs are read-only and append-only
   - Archive old logs but keep searchable

3. **Security**:
   - Department-level access control enforced at every query
   - Principle of least privilege throughout
   - All authentication attempts logged
   - Unusual access patterns flagged
   - IP tracking for all critical actions

4. **Internal Auditing**:
   - Every action traceable to specific user
   - Timestamps recorded with server time (not client time)
   - Location/IP address recorded with every action
   - Department context maintained throughout
   - Sensitive actions trigger notifications

5. **Scalability**: Design for growth (pagination, caching, indexing, query optimization)

6. **User Experience**: 
   - Ensure notification preferences prevent alert fatigue
   - But don't allow disabling critical audit notifications

7. **Data Integrity**: Transactions for critical operations (payment processing, status changes)

8. **Testing**: 
   - Unit tests for business logic
   - Integration tests for APIs
   - E2E tests for critical flows
   - Audit trail verification tests (ensure all actions logged)
   - Permission/access control tests (ensure users can't access unauthorized data)

9. **Documentation**: 
   - API documentation (Swagger/OpenAPI)
   - Architecture diagrams
   - Audit trail schema documentation
   - Security & compliance runbooks
   - Incident response procedures

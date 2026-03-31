# EagleNet Logistics Backend

A high-performance modular monolith for global logistics, shipping, and archival management.

## 🚀 Key Modules
- **Shipments**: Real-time tracking and logistics workflow engine.
- **EDMS**: Enterprise Document Management with versioning and searchable archives.
- **Financial**: Invoice generation and payment reconciliation.
- **Staff Archiving**: Bulk ingest historical records and manage hierarchical visibility.

## 🏛️ Staff-Centric Archival System (New)
The backend now supports a complete archival and audit engine:
- **Staff Proxying**: Administrators can book shipments and upload documents on behalf of external or historical companies.
- **Deep Search**: Content-based search using PostgreSQL Full-Text Search and in-memory text extraction for PDF, Word, and Excel files.
- **Bulk Ingestion**: Batch create shipment records via Excel/CSV file uploads.
- **Hierarchical Visibility**: Granular access control for documents (Global, Departmental, or Private scopes).
- **Audit Trails**: Commit messages and admin tags for every document upload and batch import.

## 🛠️ Getting Started
1. **Migrations**: `npm run migration:run` to apply new archival schema changes.
2. **Start Server**: `npm run dev`
3. **Comprehensive Test Guide**: See [API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md) for a complete, step-by-step walkthrough of all features.

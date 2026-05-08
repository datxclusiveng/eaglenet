import { Router } from "express";
import {
  uploadDocument,
  updateDocumentStatus,
  listShipmentDocuments,
  listCustomerDocuments,
  getDocumentDownloadUrl,
  deleteDocument,
} from "../controllers/document.controller";
import {
  listArchive,
  updateDocumentMeta,
} from "../controllers/archive.controller";
import {
  uploadDocumentVersion,
  listDocumentVersions,
  getDocumentActivityLog,
} from "../controllers/document-version.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { documentUpload, validateFileContent } from "../../../middleware/upload.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uploadDocumentSchema, uuidParamSchema, shipmentIdParamSchema, customerIdParamSchema } from "../../../utils/validators";
import { storageHealthCheck } from "../controllers/storage-health.controller";

const router = Router();

/**
 * Upload & Link
 */
router.post(
  "/",
  ...auth,
  authorize("document", "create"),
  documentUpload.single("file"),
  validateFileContent,
  validate(uploadDocumentSchema),
  uploadDocument
);

/**
 * Storage connectivity check — verifies Backblaze B2 (or local) is reachable.
 * GET /api/documents/storage/health
 * Restricted to Admin / Superadmin only — no secrets exposed in response.
 */
router.get(
  "/storage/health",
  ...adminOnly,
  storageHealthCheck
);

/**
 * Clearance Workflow (Admin)
 */
router.patch(
  "/:id/status",
  validate(uuidParamSchema),
  ...adminOnly,
  authorize("document", "verify"),
  updateDocumentStatus
);

/**
 * List by Shipment
 */
router.get(
  "/shipment/:shipmentId",
  validate(shipmentIdParamSchema),
  ...auth,
  authorize("document", "read"),
  listShipmentDocuments
);

/**
 * List by Customer (across all shipments)
 */
router.get(
  "/customer/:customerId",
  validate(customerIdParamSchema),
  ...auth,
  authorize("document", "read"),
  listCustomerDocuments
);


/**
 * Presigned download URL — returns a 1-hour signed B2 URL.
 * GET /api/documents/:id/download
 */
router.get(
  "/:id/download",
  validate(uuidParamSchema),
  ...auth,
  authorize("document", "read"),
  getDocumentDownloadUrl
);

/**
 * Delete a document from B2 storage and soft-delete the DB record.
 * DELETE /api/documents/:id
 */
router.delete(
  "/:id",
  validate(uuidParamSchema),
  ...auth,
  authorize("document", "delete"),
  deleteDocument
);


/**
 * EDMS: Upload a new version of an existing document
 * POST /api/documents/:id/versions
 * Requires: multipart "file" + body.comment
 */
router.post(
  "/:id/versions",
  validate(uuidParamSchema),
  ...auth,
  authorize("document", "update"),
  documentUpload.single("file"),
  validateFileContent,
  uploadDocumentVersion
);

/**
 * EDMS: List all versions of a document
 * GET /api/documents/:id/versions
 */
router.get(
  "/:id/versions",
  validate(uuidParamSchema),
  ...auth,
  authorize("document", "read"),
  listDocumentVersions
);

/**
 * EDMS: Get forensic activity log for a document
 * GET /api/documents/:id/activity
 */
router.get(
  "/:id/activity",
  validate(uuidParamSchema),
  ...auth,
  authorize("document", "read"),
  getDocumentActivityLog
);

// ── Phase 4: Archive Ledger ──────────────────────────────────────────────────

/**
 * Archive Ledger: List all archived documents with hierarchy enforcement
 * GET /api/documents/archive
 */
router.get(
  "/archive",
  ...adminOnly,
  authorize("document", "read"),
  listArchive
);

/**
 * Archive Ledger: Update admin tags, commit message, and visibility scope
 * PATCH /api/documents/:id/meta
 */
router.patch(
  "/:id/meta",
  validate(uuidParamSchema),
  ...adminOnly,
  authorize("document", "update"),
  updateDocumentMeta
);

export default router;

import { Router } from "express";
import {
  uploadDocument,
  updateDocumentStatus,
  listShipmentDocuments,
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
import { documentUpload } from "../../../middleware/upload.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uploadDocumentSchema, uuidParamSchema, shipmentIdParamSchema } from "../../../utils/validators";

const router = Router();

/**
 * Upload & Link
 */
router.post(
  "/",
  ...auth,
  authorize("document", "create"),
  documentUpload.single("file"),
  validate(uploadDocumentSchema),
  uploadDocument
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

import { Router } from "express";
import {
  createShipment,
  trackShipment,
  getShipment,
  listShipments,
  updateShipmentStatus,
  getServices,
  getLocations,
  getShipmentStats,
  getStatusHistory,
  sendManualOfficerEmail,
  createInternalNote,
} from "../controllers/shipment.controller";
import { updateCustomsStatus, getCustomsDetail } from "../controllers/customs.controller";
import { bulkImportShipmentsController } from "../controllers/bulk-import.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { bulkImportUpload } from "../../../middleware/upload.middleware";

const router = Router();

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────
router.get("/services", getServices);
router.get("/locations", getLocations);
router.get("/track/:trackingNumber", trackShipment);

// ─── STAFF/ADMIN ROUTES (PROTECTED) ──────────────────────────────────────────

/**
 * All following routes require authentication
 */
router.use(...auth);

// Dashboard stats
router.get("/stats", authorize("shipment", "read"), getShipmentStats);

// List all shipments
router.get("/", authorize("shipment", "read"), listShipments);

// Single shipment details
router.get("/:id", authorize("shipment", "read"), getShipment);

// Status history
router.get("/:id/history", authorize("shipment", "read"), getStatusHistory);

// Customs logic
router.get("/:shipmentId/customs", authorize("shipment", "read"), getCustomsDetail);
router.patch("/:shipmentId/customs", authorize("shipment", "update"), updateCustomsStatus);

// Create shipment
router.post("/", authorize("shipment", "create"), createShipment);

// Update status
router.patch("/:id/status", authorize("shipment", "update"), updateShipmentStatus);

// Internal notes
router.post("/:id/notes", authorize("shipment", "update"), createInternalNote);

// Send manual email
router.post("/:id/email", authorize("shipment", "update"), sendManualOfficerEmail);

// Bulk import
router.post(
  "/bulk-import",
  ...adminOnly,
  authorize("shipment", "create"),
  bulkImportUpload.single("file"),
  bulkImportShipmentsController
);

export default router;

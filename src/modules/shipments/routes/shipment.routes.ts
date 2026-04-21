import { Router } from "express";
import {
  createShipment,
  trackShipment,
  getShipment,
  listShipments,
  updateShipment,
  updateShipmentStatus,
  getServices,
  getLocations,
  getShipmentStats,
  getStatusHistory,
  sendManualOfficerEmail,
  createInternalNote,
  uploadDeliveryProof,
  exportShipments,
} from "../controllers/shipment.controller";
import { updateCustomsStatus, getCustomsDetail } from "../controllers/customs.controller";
import { bulkImportShipmentsController } from "../controllers/bulk-import.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { bulkImportUpload, uploadMiddleware } from "../../../middleware/upload.middleware";

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

// Export shipments
router.get("/export", authorize("shipment", "read"), exportShipments);

// List all shipments
router.get("/", authorize("shipment", "read"), listShipments);

// Single shipment details
router.get("/:id", authorize("shipment", "read"), getShipment);

// Status history / full activity log
router.get("/:id/history", authorize("shipment", "read"), getStatusHistory);

// Customs logic
router.get("/:shipmentId/customs", authorize("shipment", "read"), getCustomsDetail);
router.patch("/:shipmentId/customs", authorize("shipment", "update"), updateCustomsStatus);

// Create shipment
router.post("/", authorize("shipment", "create"), createShipment);

// Update shipment field details
router.patch("/:id", authorize("shipment", "update"), updateShipment);

// Update status only
router.patch("/:id/status", authorize("shipment", "update"), updateShipmentStatus);

// Upload delivery proof
router.post(
  "/:id/delivery-proof",
  authorize("shipment", "update"),
  uploadMiddleware.fields([{ name: "signature" }, { name: "photo" }]),
  uploadDeliveryProof
);

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

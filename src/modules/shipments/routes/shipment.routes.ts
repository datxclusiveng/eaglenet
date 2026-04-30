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
  getDeliveryNote,
} from "../controllers/shipment.controller";
import { updateCustomsStatus, getCustomsDetail } from "../controllers/customs.controller";
import { getShipmentExternalTracking, lookupExternalTrackingFreeform } from "../controllers/tracktrace.controller";
import { bulkImportShipmentsController } from "../controllers/bulk-import.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { bulkImportUpload, uploadMiddleware, validateFileContent } from "../../../middleware/upload.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { createShipmentSchema, uuidParamSchema, shipmentIdParamSchema, updateShipmentStatusSchema } from "../../../utils/validators";

const router = Router();

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────
router.get("/services", getServices);
router.get("/locations", getLocations);

// ─── EXTERNAL TRACKING (AfterShip) ───────────────────────────────────────────
/**
 * GET /api/shipments/track-external?trackingNumber=XX&carrier=DHL
 * Free-form lookup — search any external tracking number across 900+ carriers.
 * Query params: trackingNumber (required), carrier (optional hint)
 */
router.get("/track-external", ...auth, authorize("shipment", "read"), lookupExternalTrackingFreeform);
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
router.get("/:id", validate(uuidParamSchema), authorize("shipment", "read"), getShipment);

// Status history / full activity log
router.get("/:id/history", validate(uuidParamSchema), authorize("shipment", "read"), getStatusHistory);

// External tracking via AfterShip (uses shipment's flightOrVoyageNumber)
router.get("/:id/track-external", validate(uuidParamSchema), authorize("shipment", "read"), getShipmentExternalTracking);

// Customs logic
router.get("/:shipmentId/customs", validate(shipmentIdParamSchema), authorize("shipment", "read"), getCustomsDetail);
router.patch("/:shipmentId/customs", validate(shipmentIdParamSchema), authorize("shipment", "update"), updateCustomsStatus);

// Create shipment
router.post(
  "/",
  authorize("shipment", "create"),
  validate(createShipmentSchema),
  createShipment
);

// Update shipment field details
router.patch("/:id", validate(uuidParamSchema), authorize("shipment", "update"), updateShipment);

// Update status only
router.patch("/:id/status", validate(updateShipmentStatusSchema), authorize("shipment", "update"), updateShipmentStatus);

// Upload delivery proof
router.post(
  "/:id/delivery-proof",
  validate(uuidParamSchema),
  authorize("shipment", "update"),
  uploadMiddleware.fields([{ name: "signature" }, { name: "photo" }]),
  validateFileContent,
  uploadDeliveryProof
);

// Internal notes
router.post("/:id/notes", validate(uuidParamSchema), authorize("shipment", "update"), createInternalNote);

// Send manual email
router.post("/:id/email", validate(uuidParamSchema), authorize("shipment", "update"), sendManualOfficerEmail);

// JSON Delivery Note / Manifest
router.get("/:id/delivery-note", validate(uuidParamSchema), authorize("shipment", "read"), getDeliveryNote);


// Bulk import
router.post(
  "/bulk-import",
  ...adminOnly,
  authorize("shipment", "create"),
  bulkImportUpload.single("file"),
  validateFileContent,
  bulkImportShipmentsController
);

export default router;

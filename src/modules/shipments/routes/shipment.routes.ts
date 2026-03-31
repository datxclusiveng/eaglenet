import { Router } from "express";
import {
  createShipment,
  myShipments,
  trackShipment,
  getShipment,
  listShipments,
  updateShipmentStatus,
  getServices,
  getLocations,
  addTrackingCheckpoint,
  assignShipmentPrice,
} from "../controllers/shipment.controller";
import { bulkImportShipmentsController } from "../controllers/bulk-import.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { createShipmentSchema } from "../../../utils/validators";
import { bulkImportUpload } from "../../../middleware/upload.middleware";

const router = Router();

/**
 * PUBLIC: Get all services
 * GET /api/shipments/services
 */
router.get("/services", getServices);

/**
 * PUBLIC: Get all locations (Airports/Seaports)
 * GET /api/shipments/locations
 */
router.get("/locations", getLocations);

/**
 * PUBLIC: Track a shipment by tracking ID
 * GET /api/shipments/track/:trackingId
 */
router.get("/track/:trackingId", trackShipment);

/**
 * Customer: Create a booking
 * POST /api/shipments
 */
router.post("/", ...auth, authorize("shipment", "create"), validate(createShipmentSchema), createShipment);

/**
 * Customer: My bookings (paginated, filtered)
 * GET /api/shipments/mine
 */
router.get("/mine", ...auth, authorize("shipment", "read"), myShipments);

/**
 * Admin: Bulk import historical shipment records from Excel/CSV
 * POST /api/shipments/bulk-import
 * Body (form-data): file, departmentId?, commitMessage, defaultServiceId?
 */
router.post(
  "/bulk-import",
  ...adminOnly,
  authorize("shipment", "create"),
  bulkImportUpload.single("file"),
  bulkImportShipmentsController
);

/**
 * Customer/Admin: Single shipment details
 * GET /api/shipments/:id
 */
router.get("/:id", ...auth, authorize("shipment", "read"), getShipment);

/**
 * Admin: All shipments (paginated, filtered)
 * GET /api/shipments
 */
router.get("/", ...adminOnly, authorize("shipment", "read"), listShipments);

/**
 * Admin: Update shipment status
 * PATCH /api/shipments/:id/status
 */
router.patch("/:id/status", ...adminOnly, authorize("shipment", "update"), updateShipmentStatus);

/**
 * Admin: Add tracking checkpoint to a shipment
 * POST /api/shipments/:id/tracking
 */
router.post("/:id/tracking", ...adminOnly, authorize("shipment", "update"), addTrackingCheckpoint);

/**
 * Admin: Assign price to shipment
 * PATCH /api/shipments/:id/price
 */
router.patch("/:id/price", ...adminOnly, authorize("shipment", "price"), assignShipmentPrice);

export default router;

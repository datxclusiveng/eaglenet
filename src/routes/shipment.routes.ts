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
import { auth, adminOnly } from "../middleware/auth.middleware";

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
router.post("/", ...auth, createShipment);

/**
 * Customer: My bookings (paginated, filtered)
 * GET /api/shipments/mine
 * Query: ?page&limit&status&search
 */
router.get("/mine", ...auth, myShipments);

/**
 * Customer/Admin: Single shipment details
 * GET /api/shipments/:id
 */
router.get("/:id", ...auth, getShipment);

/**
 * Admin: All shipments (paginated, filtered)
 * GET /api/shipments
 * Query: ?page&limit&status&search&city&from&to
 */
router.get("/", ...adminOnly, listShipments);

/**
 * Admin: Update shipment status (and optional packageDetails/weight)
 * PATCH /api/shipments/:id/status
 * Body: { status, packageDetails?, weight? }
 */
router.patch("/:id/status", ...adminOnly, updateShipmentStatus);

/**
 * Admin: Add tracking checkpoint to a shipment
 * POST /api/shipments/:id/tracking
 * Body: { checkpoint, location, status }
 */
router.post("/:id/tracking", ...adminOnly, addTrackingCheckpoint);

/**
 * Admin: Assign price to shipment
 * PATCH /api/shipments/:id/price
 * Body: { amount }
 */
router.patch("/:id/price", ...adminOnly, assignShipmentPrice);

export default router;

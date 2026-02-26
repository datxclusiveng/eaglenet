import { Router } from "express";
import {
  createShipment,
  myShipments,
  trackShipment,
  getShipment,
  listShipments,
  updateShipmentStatus,
} from "../controllers/shipment.controller";
import { auth, adminOnly } from "../middleware/auth.middleware";

const router = Router();

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

export default router;

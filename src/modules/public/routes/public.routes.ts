import { Router } from "express";
import { trackPublic } from "../controllers/public.controller";
import { validate } from "../../../middleware/validate.middleware";
import { publicTrackingSchema } from "../../../utils/validators";

const router = Router();

/**
 * GET /api/track
 * Public — no authentication required.
 *
 * Query params (exactly one required):
 *   trackingNumber  — full public detail for a single shipment
 *   email           — summary list for that customer's shipments
 */
router.get("/", validate(publicTrackingSchema), trackPublic);

export default router;

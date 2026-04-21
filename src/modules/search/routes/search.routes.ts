import { Router } from "express";
import { globalSearchHandler } from "../controllers/search.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";

const router = Router();

/**
 * Universal Search API for the Command Palette UI
 * GET /api/search?q=value&type=shipment
 * Access is scoped based on user departmental roles.
 */
router.get("/", ...auth, authorize("search", "read"), globalSearchHandler);

export default router;

import { Router } from "express";
import { globalSearchHandler } from "../controllers/search.controller";
import { auth } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * Universal Search API for the Command Palette UI
 * GET /api/search?q=tracking_number
 */
router.get("/", ...auth, globalSearchHandler);

export default router;

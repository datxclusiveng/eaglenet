import { Router } from "express";
import { listPermissions, createPermission } from "../controllers/permission.controller";
import { auth, superAdminOnly } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * List all available system permissions
 * GET /api/permissions
 */
router.get("/", ...auth, listPermissions);

/**
 * Create a new permission definition
 * POST /api/permissions
 */
router.post("/", ...superAdminOnly, createPermission);

export default router;

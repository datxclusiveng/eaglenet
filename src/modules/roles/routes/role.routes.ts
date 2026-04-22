import { Router } from "express";
import { listRoles, createRole, updateRolePermissions } from "../controllers/role.controller";
import { auth, superAdminOnly } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * List all roles with their permissions
 * GET /api/roles
 */
router.get("/", ...auth, listRoles);

/**
 * Create a new role and attach permissions
 * POST /api/roles
 */
router.post("/", ...superAdminOnly, createRole);

/**
 * Update permissions for an existing role
 * PATCH /api/roles/:id/permissions
 */
router.patch("/:id/permissions", ...superAdminOnly, updateRolePermissions);

export default router;

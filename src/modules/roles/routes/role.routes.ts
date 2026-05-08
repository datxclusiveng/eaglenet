import { Router } from "express";
import { listRoles, createRole, updateRolePermissions, deleteRole } from "../controllers/role.controller";
import { auth, superAdminOnly } from "../../../middleware/auth.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uuidParamSchema } from "../../../utils/validators";

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
 * Delete a role (soft-delete)
 * DELETE /api/roles/:id
 */
router.delete("/:id", validate(uuidParamSchema), ...superAdminOnly, deleteRole);

/**
 * Update permissions for an existing role
 * PATCH /api/roles/:id/permissions
 */
router.patch("/:id/permissions", validate(uuidParamSchema), ...superAdminOnly, updateRolePermissions);

export default router;

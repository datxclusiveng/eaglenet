import { Router } from "express";
import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentStaff,
  listRoles,
  assignStaff,
} from "../controllers/department.controller";
import { auth, adminOnly, superAdminOnly } from "../../../middleware/auth.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uuidParamSchema } from "../../../utils/validators";

const router = Router();

// ─── Read routes (all authenticated staff) ────────────────────────────────────

/**
 * GET /api/departments
 * List all departments (paginated)
 * Query: ?page&limit&status
 */
router.get("/", ...auth, listDepartments);

/**
 * GET /api/departments/roles
 * List all available roles (for staff assignment)
 */
router.get("/roles", ...auth, listRoles);

/**
 * GET /api/departments/:id
 * Single department details with stats
 */
router.get("/:id", validate(uuidParamSchema), ...auth, getDepartment);

/**
 * GET /api/departments/:id/staff
 * Paginated staff list for a specific department
 * Query: ?page&limit
 */
router.get("/:id/staff", validate(uuidParamSchema), ...auth, getDepartmentStaff);

// ─── Write routes (Admin/SuperAdmin only) ─────────────────────────────────────

/**
 * POST /api/departments
 * Create department (SuperAdmin only)
 * Body: { name, email?, supervisorId?, metadata? }
 */
router.post("/", ...superAdminOnly, createDepartment);

/**
 * PATCH /api/departments/:id
 * Update department
 * Body: { name?, email?, supervisorId?, status?, metadata? }
 */
router.patch("/:id", validate(uuidParamSchema), ...adminOnly, updateDepartment);

/**
 * POST /api/departments/:id/staff
 * Assign an existing staff member to this department with a specific role.
 * Body: { userId, roleId }
 */
router.post("/:id/staff", validate(uuidParamSchema), ...superAdminOnly, assignStaff);

/**
 * DELETE /api/departments/:id
 * Soft-delete department (SuperAdmin only).
 * Blocked if active in-transit shipments exist.
 */
router.delete("/:id", validate(uuidParamSchema), ...superAdminOnly, deleteDepartment);

export default router;

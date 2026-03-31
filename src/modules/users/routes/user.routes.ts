import { Router } from "express";
import {
  listUsers,
  getUser,
  createAdmin,
  upgradeToAdmin,
  downgradeToCustomer,
  myDashboard,
} from "../controllers/user.controller";
import { auth, adminOnly, superAdminOnly } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/users/me/dashboard
 * Customer dashboard: basic info + outstanding balance + booking summary
 */
router.get("/me/dashboard", ...auth, myDashboard);

// ─── Admin-only routes ────────────────────────────────────────────────────────

/**
 * GET /api/users
 * Admin: list all users (paginated, searchable, filterable by role)
 * Query: ?page&limit&search&role
 */
router.get("/", ...adminOnly, listUsers);

/**
 * GET /api/users/:userId
 * Admin: get user details + total bookings
 */
router.get("/:userId", ...adminOnly, getUser);

/**
 * POST /api/users/admins
 * Superadmin: create a new admin account
 */
router.post("/admins", ...superAdminOnly, createAdmin);

/**
 * PATCH /api/users/:userId/upgrade
 * Superadmin: upgrade an existing customer to admin
 */
router.patch("/:userId/upgrade", ...superAdminOnly, upgradeToAdmin);

/**
 * PATCH /api/users/:userId/downgrade
 * Superadmin: downgrade an admin back to customer
 */
router.patch("/:userId/downgrade", ...superAdminOnly, downgradeToCustomer);

export default router;

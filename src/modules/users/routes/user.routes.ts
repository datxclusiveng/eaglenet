import { Router } from "express";
import {
  listUsers,
  getUser,
  searchStaff,
  createAdmin,
  createStaff,
  upgradeToAdmin,
  downgradeToStaff,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  myDashboard,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/user.controller";
import { auth, adminOnly, superAdminOnly } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/users/me/dashboard
 * Authenticated user's own dashboard summary
 */
router.get("/me/dashboard", ...auth, myDashboard);
router.get("/me/notifications/preferences", ...auth, getNotificationPreferences);
router.patch("/me/notifications/preferences", ...auth, updateNotificationPreferences);

// ─── Admin-only routes ─────────────────────────────────────────────────────────

/**
 * GET /api/users
 * Admin: list all users (paginated, searchable, filterable by role)
 * Query: ?page&limit&search&role
 */
router.get("/", ...adminOnly, listUsers);

/**
 * GET /api/users/staff/search
 * Admin: search staff + departments + roles
 */
router.get("/staff/search", ...adminOnly, searchStaff);

/**
 * GET /api/users/:userId
 * Admin: get staff profile + department roles + recent activity
 */
router.get("/:userId", ...adminOnly, getUser);

/**
 * POST /api/users/admins
 * SuperAdmin: create a new admin account (no department)
 */
router.post("/admins", ...superAdminOnly, createAdmin);

/**
 * POST /api/users/staff
 * SuperAdmin: create a staff member and assign to department with role
 * Body: { firstName, lastName, email, phoneNumber?, departmentId, roleId }
 */
router.post("/staff", ...superAdminOnly, createStaff);

/**
 * PATCH /api/users/:userId/upgrade
 * SuperAdmin: upgrade a user to admin
 */
router.patch("/:userId/upgrade", ...superAdminOnly, upgradeToAdmin);

/**
 * PATCH /api/users/:userId/downgrade
 * SuperAdmin: downgrade an admin back to staff member
 */
router.patch("/:userId/downgrade", ...superAdminOnly, downgradeToStaff);

/**
 * PATCH /api/users/:userId/deactivate
 * Admin: deactivate a user account (invalidates sessions)
 * Body: { reason? }
 */
router.patch("/:userId/deactivate", ...adminOnly, deactivateUser);

/**
 * PATCH /api/users/:userId/reactivate
 * Admin: reactivate a user account
 */
router.patch("/:userId/reactivate", ...adminOnly, reactivateUser);

/**
 * POST /api/users/:userId/reset-password
 * Admin: force-reset a user's password and return a temp password
 */
router.post("/:userId/reset-password", ...adminOnly, resetUserPassword);

export default router;

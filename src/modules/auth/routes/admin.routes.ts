import { Router } from "express";
import {
  getDashboardStats,
  getMonthlyReport,
  getStaffPerformance,
  listAllUsers,
} from "../controllers/admin.controller";
import { adminOnly, superAdminOnly } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/admin/dashboard
 * Admin: KPI stats + recent activities + recent shipments
 */
router.get("/dashboard", ...adminOnly, getDashboardStats);

/**
 * GET /api/admin/analytics/staff-performance
 * Admin: staff performance metrics
 */
router.get("/analytics/staff-performance", ...adminOnly, getStaffPerformance);

/**
 * GET /api/admin/reports
 * Admin: monthly report
 * Query: ?year&month
 */
router.get("/reports", ...adminOnly, getMonthlyReport);

/**
 * GET /api/admin/users
 * SuperAdmin: list all staff/users (paginated, searchable, filterable by role)
 * Query: ?page&limit&search&role
 */
router.get("/users", ...superAdminOnly, listAllUsers);

export default router;

import { Router } from "express";
import {
  getDashboardStats,
  getMonthlyReport,
} from "../controllers/admin.controller";
import { adminOnly } from "../../../middleware/auth.middleware";

const router = Router();

/**
 * Admin: Dashboard statistics
 * GET /api/admin/dashboard
 * Returns: totalUsers, totalOrders, inTransit, pending, delivered, delayed,
 *          totalRevenue, pieChart data, barChart data
 */
router.get("/dashboard", ...adminOnly, getDashboardStats);

/**
 * Admin: Monthly report
 * GET /api/admin/reports
 * Query: ?year&month
 * Returns: totalBookings, newCustomers, totalRevenue, reportReady (%)
 */
router.get("/reports", ...adminOnly, getMonthlyReport);

export default router;

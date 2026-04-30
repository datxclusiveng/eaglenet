import { Router } from "express";
import {
  shipmentReport,
  performanceReport,
  customerReport,
  financialReport,
} from "../controllers/report.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { reportFilterSchema } from "../../../utils/validators";

const router = Router();

// All report routes require authentication
router.use(...auth);

/**
 * GET /api/reports/shipments
 * Shipment volume summary — counts by status, type, top routes, monthly volume.
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=UUID&type=export|import
 */
router.get("/shipments", authorize("report", "read"), validate(reportFilterSchema), shipmentReport);

/**
 * GET /api/reports/performance
 * On-time delivery rates, status funnel, per-department breakdown.
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=UUID
 */
router.get("/performance", authorize("report", "read"), validate(reportFilterSchema), performanceReport);

/**
 * GET /api/reports/customers
 * Top customers by shipment volume with delivery stats.
 * Query: ?limit=10 (max 100)
 */
router.get("/customers", authorize("report", "read"), customerReport);

/**
 * GET /api/reports/financial
 * Total invoiced vs paid, outstanding, revenue by month, payment method breakdown.
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get("/financial", authorize("report", "read"), validate(reportFilterSchema), financialReport);

export default router;

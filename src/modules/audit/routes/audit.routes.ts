import { Router } from "express";
import { listAuditLogs } from "../controllers/audit.controller";
import { adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";

const router = Router();

/**
 * Superadmin ONLY route by architecture spec.
 * Protect via adminOnly + strict ABAC scope 'ALL' check.
 */
router.get(
  "/",
  ...adminOnly,
  authorize("audit", "read"),
  listAuditLogs
);

export default router;

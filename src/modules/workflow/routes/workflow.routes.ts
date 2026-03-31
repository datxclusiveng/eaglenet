import { Router } from "express";
import {
  attachWorkflowHandler,
  getWorkflowHandler,
  updateStepHandler,
} from "../controllers/workflow.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";

const router = Router();

/**
 * GET /api/workflows/:shipmentId
 */
router.get(
  "/:shipmentId",
  ...auth,
  authorize("workflow", "read"),
  getWorkflowHandler
);

/**
 * POST /api/workflows/:shipmentId/attach
 */
router.post(
  "/:shipmentId/attach",
  ...adminOnly,
  authorize("workflow", "create"),
  attachWorkflowHandler
);

/**
 * PATCH /api/workflows/step/:stepId
 */
router.patch(
  "/step/:stepId",
  ...adminOnly,
  authorize("workflow", "update"),
  updateStepHandler
);

export default router;

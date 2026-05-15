import { Router } from "express";
import {
  createInvoiceHandler,
  listInvoicesHandler,
  getInvoiceHandler,
  updateInvoiceHandler,
  updateInvoiceStatusHandler,
  submitForVerificationHandler,
  verifyInvoiceHandler,
  approveInvoiceHandler,
  rejectInvoiceHandler,
  sendInvoiceHandler,
  deleteInvoiceHandler,
} from "../controllers/invoice.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  rejectInvoiceSchema,
} from "../../../utils/validators";

const router = Router();

router.post(
  "/",
  ...adminOnly,
  authorize("invoice", "create"),
  validate(createInvoiceSchema),
  createInvoiceHandler
);

router.get(
  "/",
  ...adminOnly,
  authorize("invoice", "read"),
  listInvoicesHandler
);

router.get(
  "/:id",
  ...auth,
  authorize("invoice", "read"),
  getInvoiceHandler
);

router.put(
  "/:id",
  ...auth,
  authorize("invoice", "update"),
  validate(updateInvoiceSchema),
  updateInvoiceHandler
);

router.patch(
  "/:id/status",
  ...adminOnly,
  authorize("invoice", "update"),
  validate(updateInvoiceStatusSchema),
  updateInvoiceStatusHandler
);

router.post(
  "/:id/submit",
  ...auth,
  authorize("invoice", "update"),
  submitForVerificationHandler
);

router.post(
  "/:id/verify",
  ...adminOnly,
  authorize("invoice", "update"),
  verifyInvoiceHandler
);

router.post(
  "/:id/approve",
  ...adminOnly,
  authorize("invoice", "update"),
  approveInvoiceHandler
);

router.post(
  "/:id/reject",
  ...adminOnly,
  authorize("invoice", "update"),
  validate(rejectInvoiceSchema),
  rejectInvoiceHandler
);

router.post(
  "/:id/send",
  ...adminOnly,
  authorize("invoice", "update"),
  sendInvoiceHandler
);

router.delete(
  "/:id",
  ...adminOnly,
  authorize("invoice", "delete"),
  deleteInvoiceHandler
);

export default router;

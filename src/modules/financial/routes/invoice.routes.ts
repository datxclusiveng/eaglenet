import { Router } from "express";
import {
  createInvoiceHandler,
  listInvoicesHandler,
  myInvoicesHandler,
  getInvoiceHandler,
  updateInvoiceStatusHandler,
  deleteInvoiceHandler,
} from "../controllers/invoice.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { createInvoiceSchema, updateInvoiceStatusSchema } from "../../../utils/validators";

const router = Router();

/**
 * Admin: Create a new invoice (standalone or shipment-linked)
 * POST /api/invoices
 */
router.post(
  "/",
  ...adminOnly,
  authorize("invoice", "create"),
  validate(createInvoiceSchema),
  createInvoiceHandler
);

/**
 * Admin: List all invoices (paginated, filterable by status)
 * GET /api/invoices?status=SENT
 */
router.get(
  "/",
  ...adminOnly,
  authorize("invoice", "read"),
  listInvoicesHandler
);

/**
 * Customer: My invoices (from shipments they own)
 * GET /api/invoices/mine
 */
router.get(
  "/mine",
  ...auth,
  authorize("invoice", "read"),
  myInvoicesHandler
);

/**
 * Customer / Admin: Single invoice detail
 * GET /api/invoices/:id
 */
router.get(
  "/:id",
  ...auth,
  authorize("invoice", "read"),
  getInvoiceHandler
);

/**
 * Admin: Update invoice status
 * PATCH /api/invoices/:id/status
 */
router.patch(
  "/:id/status",
  ...adminOnly,
  authorize("invoice", "update"),
  validate(updateInvoiceStatusSchema),
  updateInvoiceStatusHandler
);

/**
 * Admin: Soft-delete an invoice
 * DELETE /api/invoices/:id
 */
router.delete(
  "/:id",
  ...adminOnly,
  authorize("invoice", "delete"),
  deleteInvoiceHandler
);

export default router;

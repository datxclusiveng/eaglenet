import { Router } from "express";
import {
  createVoucher,
  getVoucher,
  listVouchers,
  updateVoucherStatus,
} from "../controllers/voucher.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uploadMiddleware, validateFileContent } from "../../../middleware/upload.middleware";
import {
  createVoucherSchema,
  updateVoucherStatusSchema,
  uuidParamSchema,
} from "../../../utils/validators";

const router = Router();

const voucherUploads = uploadMiddleware.fields([
  { name: "receipt", maxCount: 1 },
  { name: "staffSignature", maxCount: 1 },
  { name: "receivedBySignature", maxCount: 1 },
  { name: "issuedBySignature", maxCount: 1 },
  { name: "authorizedSignature", maxCount: 1 },
]);

/**
 * Create a new voucher
 * POST /api/vouchers
 */
router.post(
  "/",
  ...auth,
  authorize("voucher", "create"),
  voucherUploads,
  validateFileContent,
  validate(createVoucherSchema),
  createVoucher
);

/**
 * List all vouchers
 * GET /api/vouchers
 */
router.get(
  "/",
  ...auth,
  authorize("voucher", "read"),
  listVouchers
);

/**
 * Get details of a single voucher
 * GET /api/vouchers/:id
 */
router.get(
  "/:id",
  validate(uuidParamSchema),
  ...auth,
  authorize("voucher", "read"),
  getVoucher
);

/**
 * Approve or Reject a voucher
 * PATCH /api/vouchers/:id/status
 */
router.patch(
  "/:id/status",
  ...auth,
  authorize("voucher", "update"),
  voucherUploads,
  validateFileContent,
  validate(updateVoucherStatusSchema),
  updateVoucherStatus
);

export default router;

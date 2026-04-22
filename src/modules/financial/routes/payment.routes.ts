import { Router } from "express";
import {
  initializePayment,
  paystackWebhook,
  verifyPayment,
  myPayments,
  listPayments,
  getPayment,
  processManualPayment,
} from "../controllers/payment.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uuidParamSchema } from "../../../utils/validators";
import express from "express";

const router = Router();

/**
 * PUBLIC: Paystack webhook (raw body needed for HMAC verification)
 * POST /api/payments/webhook
 * Note: Must be before any JSON body-parser override
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhook,
);

/**
 * Staff: Initialize payment for a shipment
 * POST /api/payments/initialize
 */
router.post("/initialize", ...auth, authorize("payment", "create"), initializePayment);

/**
 * Staff/Admin: Verify a payment by reference
 * GET /api/payments/verify/:reference
 */
router.get("/verify/:reference", ...auth, authorize("payment", "read"), verifyPayment);

/**
 * Staff: My payment history
 * GET /api/payments/mine
 */
router.get("/mine", ...auth, authorize("payment", "read"), myPayments);


/**
 * Admin: All payments
 * GET /api/payments
 */
router.get("/", ...adminOnly, authorize("payment", "read"), listPayments);

/**
 * Admin: Single payment detail
 * GET /api/payments/:id
 */
router.get("/:id", validate(uuidParamSchema), ...adminOnly, authorize("payment", "read"), getPayment);

/**
 * Admin/Payment Dept: Manually accept or reject a payment
 * PATCH /api/payments/:id/process
 */
router.patch("/:id/process", validate(uuidParamSchema), ...adminOnly, authorize("payment", "update"), processManualPayment);

export default router;

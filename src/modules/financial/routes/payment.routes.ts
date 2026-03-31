import { Router } from "express";
import {
  initializePayment,
  paystackWebhook,
  verifyPayment,
  myPayments,
  listPayments,
  getPayment,
} from "../controllers/payment.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
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
 * Customer: Initialize payment for a shipment
 * POST /api/payments/initialize
 */
router.post("/initialize", ...auth, authorize("payment", "create"), initializePayment);

/**
 * Customer/Admin: Verify a payment by reference
 * GET /api/payments/verify/:reference
 */
router.get("/verify/:reference", ...auth, authorize("payment", "read"), verifyPayment);

/**
 * Customer: My payment history
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
router.get("/:id", ...adminOnly, authorize("payment", "read"), getPayment);

export default router;

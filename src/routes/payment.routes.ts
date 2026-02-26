import { Router } from "express";
import {
  initializePayment,
  paystackWebhook,
  verifyPayment,
  myPayments,
  listPayments,
  getPayment,
} from "../controllers/payment.controller";
import { auth, adminOnly } from "../middleware/auth.middleware";
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
 * Body: { shipmentId, amount }
 */
router.post("/initialize", ...auth, initializePayment);

/**
 * Customer/Admin: Verify a payment by reference
 * GET /api/payments/verify/:reference
 */
router.get("/verify/:reference", ...auth, verifyPayment);

/**
 * Customer: My payment history
 * GET /api/payments/mine
 * Query: ?page&limit&status&search
 */
router.get("/mine", ...auth, myPayments);

/**
 * Admin: All payments
 * GET /api/payments
 * Query: ?page&limit&status&search&from&to
 */
router.get("/", ...adminOnly, listPayments);

/**
 * Admin: Single payment detail (linked to shipment)
 * GET /api/payments/:id
 */
router.get("/:id", ...adminOnly, getPayment);

export default router;

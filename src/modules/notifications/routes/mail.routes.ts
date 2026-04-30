import { Router } from "express";
import { sendCustomEmail, listMailLogs } from "../controllers/mail.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { sendMailSchema } from "../../../utils/validators";

const router = Router();

// Middleware for all mail routes
router.use(...auth);

/**
 * GET /api/mail
 * List mail logs (Admin only)
 */
router.get("/", authorize("mail", "read"), listMailLogs);

/**
 * POST /api/mail/send
 * Send a custom dynamic email with 'to', 'subject', and 'body'.
 */
router.post(
  "/send",
  authorize("mail", "send"),
  validate(sendMailSchema),
  sendCustomEmail
);

export default router;

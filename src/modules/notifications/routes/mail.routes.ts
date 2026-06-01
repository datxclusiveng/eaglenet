import { Router } from "express";
import { sendCustomEmail, listMailLogs } from "../controllers/mail.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { uploadMiddleware, validateFileContent } from "../../../middleware/upload.middleware";
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
 * Send a custom dynamic email with 'to', 'subject', 'body', and optional file attachments.
 * Accepts multipart/form-data with fields: to, subject, body, attachments (files, max 10).
 */
router.post(
  "/send",
  authorize("mail", "send"),
  uploadMiddleware.fields([{ name: "attachments", maxCount: 10 }]),
  validateFileContent,
  validate(sendMailSchema),
  sendCustomEmail
);

export default router;

import { Router } from "express";
import { sendCustomEmail } from "../controllers/mail.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { sendMailSchema } from "../../../utils/validators";

const router = Router();

/**
 * POST /api/mail/send
 * Send a custom dynamic email with 'to', 'subject', and 'body'.
 * Gated by 'mail:send' permission or similar.
 */
router.post(
  "/send",
  ...auth,
  authorize("mail", "send"),
  validate(sendMailSchema),
  sendCustomEmail
);

export default router;

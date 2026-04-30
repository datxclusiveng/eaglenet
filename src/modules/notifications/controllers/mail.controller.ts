import { Request, Response } from "express";
import { send } from "../services/email.service";
import { User } from "../../users/entities/User";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";

/**
 * POST /api/mail/send
 * Free-form email sender for staff/admins.
 */
export async function sendCustomEmail(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { to, subject, body } = req.body;

    await send({
      to,
      subject,
      html: body,
      sentById: user.id,
    });

    createAuditLog({
      entityType: "Email",
      action: AuditAction.SEND,
      actionDetails: { to, subject, body_preview: body?.substring(0, 50) },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "Custom email sent successfully.");
  } catch (err) {
    console.error("[MailController.sendCustomEmail]", err);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while sending the email.",
    });
  }
}

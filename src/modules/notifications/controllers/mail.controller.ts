import { Request, Response } from "express";
import { send } from "../services/email.service";
import { User, UserRole } from "../../users/entities/User";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { AppDataSource } from "../../../../database/data-source";
import { EmailLog } from "../entities/EmailLog";
import { parsePagination, paginate, sanitizeUser } from "../../../utils/helpers";
import { uploadFile } from "../../../utils/storage.service";

/**
 * POST /api/mail/send
 * Free-form email sender for staff/admins.
 * Supports optional file attachments (multipart/form-data).
 */
export async function sendCustomEmail(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { to, subject, body } = req.body;

    // Extract uploaded files from multer (undefined if no files sent)
    const uploadedFiles =
      (req.files as { [fieldname: string]: Express.Multer.File[] } | undefined)?.["attachments"] ?? [];

    // Build attachment arrays
    const emailAttachments: Array<{ filename: string; content: Buffer; content_type: string }> = [];
    const attachmentUrls: Array<{ name: string; url: string }> = [];

    if (uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        // Upload to B2 for audit trail persistence
        const uploaded = await uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          "mail-attachments"
        );
        attachmentUrls.push({ name: file.originalname, url: uploaded.url });

        // Keep buffer for direct email attachment
        emailAttachments.push({
          filename: file.originalname,
          content: file.buffer,
          content_type: file.mimetype,
        });
      }
    }

    await send({
      to,
      subject,
      html: body,
      sentById: user.id,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      attachmentUrls: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : undefined,
    });

    createAuditLog({
      entityType: "Email",
      action: AuditAction.SEND,
      actionDetails: {
        to,
        subject,
        body_preview: body?.substring(0, 50),
        attachment_count: uploadedFiles.length > 0 ? uploadedFiles.length : undefined,
        attachment_names: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.originalname) : undefined,
      },
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

/**
 * GET /api/mail/logs
 * List all emails sent through the system with content.
 * Only Superadmins/Admins.
 */
export async function listMailLogs(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);

    // Security check: Only admins/superadmins can see global mail logs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
        return res.status(403).json({ status: "error", message: "Forbidden: Admin access required." });
    }

    const [logs, total] = await AppDataSource.getRepository(EmailLog).findAndCount({
      relations: ["sentBy", "shipment"],
      order: { sentAt: "DESC" },
      skip,
      take: limit,
    });

    const sanitized = logs.map(log => ({
      ...log,
      sentBy: log.sentBy ? sanitizeUser(log.sentBy) : null,
      shipment: log.shipment ? {
        id: log.shipment.id,
        trackingNumber: log.shipment.trackingNumber,
        shipmentName: log.shipment.shipmentName,
        status: log.shipment.status,
      } : null,
    }));

    return (res as any).success(sanitized, "Mail logs retrieved successfully.", paginate(total, page, limit));
  } catch (err) {
    console.error("[MailController.listMailLogs]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}


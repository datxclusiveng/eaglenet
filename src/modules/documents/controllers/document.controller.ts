import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Document, DocumentStatus, VisibilityScope } from "../entities/Document";
import { User, UserRole } from "../../users/entities/User";
import { sendPushNotification } from "../../notifications/services/push-notification.service";
import { NotificationType } from "../../notifications/entities/Notification";
import { createDocumentVersion, logDocumentActivity } from "../services/document.service";
import { DocumentAction } from "../entities/DocumentActivity";
import { uploadFile } from "../../../utils/storage.service";
import { parsePagination, paginate } from "../../../utils/helpers";
import { extractTextFromBuffer } from "../services/text-extractor.service";

const repo = () => AppDataSource.getRepository(Document);

/**
 * Upload a document and link to a shipment.
 * POST /api/documents/upload
 * Body: { shipmentId, name, documentType }
 */
export async function uploadDocument(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded." });
    }

    const {
      shipmentId,
      name,
      documentType,
      metadata,
      isArchived,
      visibilityScope,
      adminTags,
      commitMessage,
    } = req.body;

    const { url, key } = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "documents"
    );

    // Run text extraction (won't crash if unsupported)
    const extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);

    const doc = repo().create({
      name: name || req.file.originalname,
      fileUrl: url,
      fileKey: key,
      contentType: req.file.mimetype,
      documentType: documentType || "GENERAL",
      status: DocumentStatus.PENDING,
      uploaderId: user.id,
      departmentId: (req as any).permissionScope?.departmentId,
      shipmentId,
      metadata: metadata ? JSON.parse(metadata) : {},
      isArchived: isArchived === "true" || isArchived === true,
      visibilityScope: visibilityScope || VisibilityScope.GLOBAL,
      adminTags: typeof adminTags === "string" ? JSON.parse(adminTags) : adminTags,
      commitMessage,
      extractedText: extractedText || undefined,
    });

    await repo().save(doc);

    // Automatically create version 1 and log the upload activity
    await createDocumentVersion(
      doc.id,
      user.id,
      {
        fileUrl: doc.fileUrl,
        fileKey: doc.fileKey,
        contentType: doc.contentType,
      },
      commitMessage || "Initial upload"
    );

    return res.status(201).json({ status: "success", data: doc });
  } catch (err) {
    console.error("[DocumentController.upload]", err);
    return res.status(500).json({ status: "error", message: "Error uploading document." });
  }
}

/**
 * Verify / Reject a document.
 * PATCH /api/documents/:id/status
 */
export async function updateDocumentStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, comment } = req.body;

    if (!Object.values(DocumentStatus).includes(status)) {
      return res.status(400).json({ status: "error", message: "Invalid status." });
    }

    const doc = await repo().findOneBy({ id });
    if (!doc) return res.status(404).json({ status: "error", message: "Document not found." });

    doc.status = status;
    doc.metadata = { ...doc.metadata, last_review_comment: comment };

    await repo().save(doc);

    // Log the status change as a document activity
    const action = status === DocumentStatus.VERIFIED
      ? DocumentAction.APPROVED
      : DocumentAction.REJECTED;

    await logDocumentActivity(doc.id, (req as any).user?.id || doc.uploaderId, action, comment);

    // Push Notif
    sendPushNotification(doc.uploaderId, "Document Clearance 📄", `Your ${doc.documentType} has been ${status.toLowerCase()}.`, NotificationType.STATUS_UPDATE, `/shipments/${doc.shipmentId}`).catch(console.error);

    return res.status(200).json({ status: "success", data: doc });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

/**
 * List documents for a shipment.
 * GET /api/documents/shipment/:shipmentId
 */
export async function listShipmentDocuments(req: Request, res: Response) {
  try {
    const shipmentId = req.params.shipmentId as string;
    const { page, limit, skip } = parsePagination(req.query);
    const user = (req as any).user as User;
    const { departmentId: userDeptId } = (req as any).permissionScope || {};

    const qb = repo().createQueryBuilder("d");
    qb.where("d.shipmentId = :shipmentId", { shipmentId });

    // Enforce Hierarchy View unless Superadmin
    if (user.role !== UserRole.SUPERADMIN) {
      qb.andWhere(
        "(d.visibilityScope = :global OR d.uploaderId = :uid OR (d.visibilityScope = :dept AND d.departmentId = :uDept))",
        {
          global: VisibilityScope.GLOBAL,
          uid: user.id,
          dept: VisibilityScope.DEPARTMENT,
          uDept: userDeptId,
        }
      );
    }

    qb.orderBy("d.createdAt", "DESC").skip(skip).take(limit);
    const [docs, total] = await qb.getManyAndCount();

    return res.status(200).json({ status: "success", data: docs, meta: paginate(total, page, limit) });
  } catch (err) {
    console.error("[DocumentController.list]", err);
    return res.status(500).json({ status: "error", message: "Error fetching documents." });
  }
}

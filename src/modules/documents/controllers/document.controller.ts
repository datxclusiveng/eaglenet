import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Document, DocumentStatus, VisibilityScope } from "../entities/Document";
import { User, UserRole } from "../../users/entities/User";
import { sendPushNotification } from "../../notifications/services/push-notification.service";
import { NotificationType } from "../../notifications/entities/Notification";
import { Customer } from "../../customers/entities/Customer";
import { createDocumentVersion, logDocumentActivity } from "../services/document.service";
import { DocumentAction } from "../entities/DocumentActivity";
import { uploadFile, getPresignedDownloadUrl, deleteFileFromStorage } from "../../../utils/storage.service";
import { parsePagination, paginate } from "../../../utils/helpers";
import { extractTextFromBuffer } from "../services/text-extractor.service";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { serializeEntity, serializePaginatedResponse } from "../../../utils/serializers";

const repo = () => AppDataSource.getRepository(Document);

/**
 * Upload a document and link to a shipment.
 * POST /api/documents
 * Body (multipart): { shipmentId, name, documentType, ... } + file field "file"
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
      fileSize: req.file.size,
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
        fileSize: req.file.size,
      },
      commitMessage || "Initial upload"
    );

    return res.status(201).json({ status: "success", data: serializeEntity(doc) });
  } catch (err) {
    console.error("[DocumentController.upload]", err);
    return res.status(500).json({ status: "error", message: "Error uploading document." });
  }
}

/**
 * Generate a presigned download URL for a document.
 * GET /api/documents/:id/download
 *
 * Enforces visibility scope, logs the download activity, and returns a
 * short-lived (1-hour) signed URL so the client can fetch the file directly
 * from Backblaze B2 without exposing long-lived credentials.
 */
export async function getDocumentDownloadUrl(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { departmentId: userDeptId } = (req as any).permissionScope || {};
    const id = req.params.id as string;

    const doc = await repo().findOneBy({ id });
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    // ── Visibility enforcement ──────────────────────────────────────────────
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.ADMIN) {
      if (doc.visibilityScope === VisibilityScope.PRIVATE && doc.uploaderId !== user.id) {
        return res.status(403).json({ status: "error", message: "Access denied: private document." });
      }
      if (
        doc.visibilityScope === VisibilityScope.DEPARTMENT &&
        doc.departmentId !== userDeptId &&
        doc.uploaderId !== user.id
      ) {
        return res.status(403).json({ status: "error", message: "Access denied: department-scoped document." });
      }
    }

    // 1-hour presigned URL
    const signedUrl = await getPresignedDownloadUrl(doc.fileKey, 3600);

    // Log the download (fire-and-forget)
    logDocumentActivity(doc.id, user.id, DocumentAction.DOWNLOADED).catch(console.error);

    createAuditLog({
      entityType: "Document",
      entityId: doc.id,
      action: AuditAction.VIEW,
      actionDetails: { event: "download_url_generated", fileName: doc.name },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({
      status: "success",
      data: {
        downloadUrl: signedUrl,
        fileName: doc.name,
        contentType: doc.contentType,
        expiresInSeconds: 3600,
      },
    });
  } catch (err) {
    console.error("[DocumentController.getDownloadUrl]", err);
    return res.status(500).json({ status: "error", message: "Error generating download URL." });
  }
}

/**
 * Delete a document — removes the record from the database AND the file from B2.
 * DELETE /api/documents/:id
 *
 * Only the uploader or an Admin/Superadmin can delete a document.
 * Uses TypeORM soft-delete so the row is retained for audit purposes,
 * but the B2 object is permanently removed.
 */
export async function deleteDocument(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;

    const doc = await repo().findOneBy({ id });
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    // ── Authorization ───────────────────────────────────────────────────────
    const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    if (!isPrivileged && doc.uploaderId !== user.id) {
      return res.status(403).json({
        status: "error",
        message: "Access denied: only the uploader or an admin can delete this document.",
      });
    }

    // ── Remove from B2 (or local disk) ─────────────────────────────────────
    // Do this first — if it fails, we don't orphan the DB record
    await deleteFileFromStorage(doc.fileKey);

    // ── Soft-delete the DB record (deletedAt is set; row retained for audit) ─
    await repo().softDelete({ id });

    // ── Log the deletion ────────────────────────────────────────────────────
    await logDocumentActivity(doc.id, user.id, DocumentAction.DELETED);

    createAuditLog({
      entityType: "Document",
      entityId: doc.id,
      action: AuditAction.DELETE,
      actionDetails: { fileName: doc.name, fileKey: doc.fileKey, shipmentId: doc.shipmentId },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", message: "Document deleted successfully." });
  } catch (err) {
    console.error("[DocumentController.delete]", err);
    return res.status(500).json({ status: "error", message: "Error deleting document." });
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

    return res.status(200).json({ status: "success", data: serializeEntity(doc) });
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

    return res.status(200).json(serializePaginatedResponse(docs, paginate(total, page, limit)));
  } catch (err) {
    console.error("[DocumentController.list]", err);
    return res.status(500).json({ status: "error", message: "Error fetching documents." });
  }
}

/**
 * List all documents for a specific client (across all their shipments).
 * GET /api/documents/customer/:customerId
 */
export async function listCustomerDocuments(req: Request, res: Response) {
  try {
    const customerId = req.params.customerId as string;
    const { page, limit, skip } = parsePagination(req.query);
    const user = (req as any).user as User;
    const { departmentId: userDeptId } = (req as any).permissionScope || {};

    // 1. Find the customer to get their email
    const customer = await AppDataSource.getRepository(Customer).findOneBy({ id: customerId });
    if (!customer) {
      return res.status(404).json({ status: "error", message: "Customer not found." });
    }

    // 2. Query documents belonging to any shipment with this client's email
    const qb = repo().createQueryBuilder("d")
      .select([
        "d.id", "d.name", "d.fileUrl", "d.contentType", "d.documentType",
        "d.status", "d.visibilityScope", "d.isArchived", "d.createdAt", "d.fileSize",
      ])
      .innerJoin("d.shipment", "s")
      .where("s.clientEmail = :email", { email: customer.email });

    // Enforce visibility scoping (RBAC)
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.ADMIN) {
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

    createAuditLog({
      entityType: "Customer",
      entityId: customerId,
      action: AuditAction.VIEW,
      actionDetails: { event: "list_customer_documents", customerEmail: customer.email },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(docs.map(serializeEntity), "Customer documents retrieved successfully.", paginate(total, page, limit));
  } catch (err) {
    console.error("[DocumentController.listCustomerDocuments]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

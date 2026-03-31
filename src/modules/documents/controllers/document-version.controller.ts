import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { AppDataSource } from "../../../../database/data-source";
import { Document } from "../entities/Document";
import {
  createDocumentVersion,
  getDocumentVersions,
  logDocumentActivity,
  getDocumentActivity,
} from "../services/document.service";
import { DocumentAction } from "../entities/DocumentActivity";
import { uploadFile } from "../../../utils/storage.service";
import { parsePagination, paginate } from "../../../utils/helpers";

const docRepo = () => AppDataSource.getRepository(Document);

// ─── POST /api/documents/:id/versions ─────────────────────────────────────
/**
 * Upload a new version of an existing document.
 * Requires: multipart/form-data with a "file" field and "comment" in body.
 */
export async function uploadDocumentVersion(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const documentId = req.params.id as string;
    const { comment } = req.body;

    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded." });
    }
    if (!comment) {
      return res.status(400).json({ status: "error", message: "A commit comment is required for every new version." });
    }

    // Ensure document exists and belongs to uploader (or user is admin)
    const doc = await docRepo().findOne({ where: { id: documentId } });
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    const { url, key } = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "documents"
    );

    const version = await createDocumentVersion(
      documentId,
      user.id,
      {
        fileUrl: url,
        fileKey: key,
        contentType: req.file.mimetype,
      },
      comment
    );

    return res.status(201).json({ status: "success", data: version });
  } catch (err) {
    console.error("[DocumentVersionController.upload]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/documents/:id/versions ───────────────────────────────────────
/**
 * List all versions of a document in descending order (newest first).
 */
export async function listDocumentVersions(req: Request, res: Response) {
  try {
    const documentId = req.params.id as string;
    const { page, limit, skip } = parsePagination(req.query);

    const doc = await docRepo().findOne({ where: { id: documentId } });
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    const [versions, total] = await getDocumentVersions(documentId, { skip, take: limit });
    return res.status(200).json({ status: "success", data: versions, meta: paginate(total, page, limit) });
  } catch (err) {
    console.error("[DocumentVersionController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/documents/:id/activity ───────────────────────────────────────
/**
 * Retrieve the full forensic activity log for a document.
 */
export async function getDocumentActivityLog(req: Request, res: Response) {
  try {
    const documentId = req.params.id as string;
    const user = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);

    const doc = await docRepo().findOne({ where: { id: documentId } });
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    // Log that this user viewed the activity log
    await logDocumentActivity(documentId, user.id, DocumentAction.VIEWED);

    const [activity, total] = await getDocumentActivity(documentId, { skip, take: limit });
    return res.status(200).json({ status: "success", data: activity, meta: paginate(total, page, limit) });
  } catch (err) {
    console.error("[DocumentVersionController.activity]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

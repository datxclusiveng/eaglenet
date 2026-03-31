import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Document, VisibilityScope } from "../entities/Document";
import { User, UserRole } from "../../users/entities/User";
import { parsePagination, paginate } from "../../../utils/helpers";

const repo = () => AppDataSource.getRepository(Document);

/**
 * Phase 4 — Archive Ledger
 * GET /api/documents/archive
 *
 * Lists all archived documents with full hierarchy enforcement:
 *  - SUPERADMIN: sees everything
 *  - Department Staff: sees GLOBAL + own DEPARTMENT scope
 *  - Any Staff: sees their own PRIVATE uploads
 *
 * Supports filters: ?departmentId, ?documentType, ?uploaderId, ?tags
 */
export async function listArchive(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { departmentId: userDeptId } = (req as any).permissionScope || {};
    const { page, limit, skip } = parsePagination(req.query);

    // Optional filters
    const { departmentId, documentType, uploaderId, tag } = req.query;

    const qb = repo()
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.uploader", "uploader")
      .leftJoinAndSelect("d.department", "department")
      .where("d.isArchived = :archived", { archived: true });

    // ── Hierarchy Enforcement ────────────────────────────────────────────────
    if (user.role !== UserRole.SUPERADMIN) {
      qb.andWhere(
        "(d.visibilityScope = :global OR d.uploaderId = :uid OR " +
        "(d.visibilityScope = :dept AND d.departmentId = :uDept))",
        {
          global: VisibilityScope.GLOBAL,
          uid: user.id,
          dept: VisibilityScope.DEPARTMENT,
          uDept: userDeptId,
        }
      );
    }

    // ── Optional Filters ─────────────────────────────────────────────────────
    if (departmentId) {
      qb.andWhere("d.departmentId = :departmentId", { departmentId });
    }
    if (documentType) {
      qb.andWhere("d.documentType = :documentType", { documentType });
    }
    if (uploaderId) {
      qb.andWhere("d.uploaderId = :uploaderId", { uploaderId });
    }
    if (tag) {
      // JSONB array contains filter
      qb.andWhere("d.adminTags @> :tag", { tag: JSON.stringify([tag]) });
    }

    qb.orderBy("d.createdAt", "DESC").skip(skip).take(limit);
    const [docs, total] = await qb.getManyAndCount();

    return res.status(200).json({
      status: "success",
      data: docs,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[ArchiveController.list]", err);
    return res.status(500).json({ status: "error", message: "Error fetching archive." });
  }
}

/**
 * Phase 4 — Update Tags & Commit Message
 * PATCH /api/documents/:id/meta
 *
 * Allows an admin to update adminTags, commitMessage, and visibilityScope
 * on an already-uploaded document without re-uploading the file.
 *
 * Only the uploader or a Superadmin can edit tags on a PRIVATE document.
 */
export async function updateDocumentMeta(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const user = (req as any).user as User;
    const { adminTags, commitMessage, visibilityScope } = req.body;

    const doc = await repo().findOneBy({ id });
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    // Ownership check for PRIVATE documents
    if (
      doc.visibilityScope === VisibilityScope.PRIVATE &&
      user.role !== UserRole.SUPERADMIN &&
      doc.uploaderId !== user.id
    ) {
      return res.status(403).json({
        status: "error",
        message: "Access Denied: Only the uploader or Superadmin can modify a PRIVATE document.",
      });
    }

    // Apply updates
    if (adminTags !== undefined) {
      doc.adminTags = Array.isArray(adminTags) ? adminTags : JSON.parse(adminTags);
    }
    if (commitMessage !== undefined) {
      doc.commitMessage = commitMessage;
    }
    if (visibilityScope !== undefined) {
      // Only Superadmin can escalate scope upward (e.g., PRIVATE → GLOBAL)
      if (
        visibilityScope === VisibilityScope.GLOBAL &&
        user.role !== UserRole.SUPERADMIN &&
        doc.uploaderId !== user.id
      ) {
        return res.status(403).json({
          status: "error",
          message: "Access Denied: Only a Superadmin can make a document globally visible.",
        });
      }
      doc.visibilityScope = visibilityScope;
    }

    await repo().save(doc);

    return res.status(200).json({
      status: "success",
      message: "Document metadata updated.",
      data: {
        id: doc.id,
        name: doc.name,
        adminTags: doc.adminTags,
        commitMessage: doc.commitMessage,
        visibilityScope: doc.visibilityScope,
      },
    });
  } catch (err) {
    console.error("[ArchiveController.updateMeta]", err);
    return res.status(500).json({ status: "error", message: "Error updating document metadata." });
  }
}

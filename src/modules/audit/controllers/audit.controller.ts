import { Request, Response } from "express";
import { getAuditLogs } from "../services/audit.service";
import { paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import { User, UserRole } from "../../users/entities/User";

/**
 * GET /api/audit
 * Fetch audit logs with rich filtering.
 * SuperAdmin: sees all logs
 * Department managers: only logs scoped to their department
 */
export async function listAuditLogs(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);

    // Parse filters
    const performedBy = req.query.performedBy as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const action = req.query.action as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    // Non-superadmins can only see their own action logs unless they pass a dept filter
    const effectivePerformedBy =
      actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN
        ? actor.id
        : performedBy;

    const [rows, total] = await getAuditLogs({
      skip,
      take: limit,
      performedBy: effectivePerformedBy,
      entityType,
      entityId,
      action,
      departmentId,
      from,
      to,
    });

    const sanitizedRows = rows.map((log: any) => ({
      ...log,
      performer: log.performer ? sanitizeUser(log.performer) : null,
    }));

    return res.status(200).json({
      status: "success",
      data: sanitizedRows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[AuditController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

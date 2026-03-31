import { Request, Response } from "express";
import { getAuditLogs } from "../services/audit.service";
import { paginate, parsePagination } from "../../../utils/helpers";

/**
 * GET /api/audit
 * Fetch all forensic logs. Filters by `userId` or `resource` through query string.
 */
export async function listAuditLogs(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const userId = req.query.userId as string | undefined;
    const resource = req.query.resource as string | undefined;

    const [rows, total] = await getAuditLogs({
      skip,
      take: limit,
      userId,
      resource,
    });

    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[AuditController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

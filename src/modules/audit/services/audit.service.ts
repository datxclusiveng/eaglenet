import { AppDataSource } from "../../../../database/data-source";
import { AuditLog, AuditAction } from "../entities/AuditLog";

export { AuditAction };

const auditRepo = () => AppDataSource.getRepository(AuditLog);

export interface CreateAuditLogDto {
  entityType: string;
  entityId?: string;
  action: string;
  actionDetails?: Record<string, any>;
  performedBy?: string;
  departmentId?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

/**
 * Log a system activity in the immutable audit trail.
 * This is fire-and-forget — it never throws or blocks the main request.
 */
export async function createAuditLog(data: CreateAuditLogDto): Promise<void> {
  try {
    const log = auditRepo().create({
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      actionDetails: data.actionDetails,
      performedBy: data.performedBy,
      departmentId: data.departmentId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      reason: data.reason,
    });
    await auditRepo().save(log);
  } catch (err) {
    // Audit log failures must never crash the main application
    console.error("[AuditService] Failed to write audit log:", err);
  }
}

/**
 * Retrieve paginated audit logs with rich filtering.
 */
export async function getAuditLogs(opts: {
  skip: number;
  take: number;
  performedBy?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  departmentId?: string;
  from?: Date;
  to?: Date;
}): Promise<[AuditLog[], number]> {
  const qb = auditRepo()
    .createQueryBuilder("audit")
    .leftJoinAndSelect("audit.performer", "u")
    .orderBy("audit.performedAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  if (opts.performedBy) {
    qb.andWhere("audit.performedBy = :uid", { uid: opts.performedBy });
  }
  if (opts.entityType) {
    qb.andWhere("audit.entityType = :et", { et: opts.entityType });
  }
  if (opts.entityId) {
    qb.andWhere("audit.entityId = :eid", { eid: opts.entityId });
  }
  if (opts.action) {
    qb.andWhere("audit.action = :action", { action: opts.action });
  }
  if (opts.departmentId) {
    qb.andWhere("audit.departmentId = :deptId", { deptId: opts.departmentId });
  }
  if (opts.from) {
    qb.andWhere("audit.performedAt >= :from", { from: opts.from });
  }
  if (opts.to) {
    qb.andWhere("audit.performedAt <= :to", { to: opts.to });
  }

  return qb.getManyAndCount();
}

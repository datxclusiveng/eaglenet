import { AppDataSource } from "../../../../database/data-source";
import { AuditLog } from "../entities/AuditLog";

const auditRepo = () => AppDataSource.getRepository(AuditLog);

/**
 * Log a system activity natively in the forensic audit trail.
 */
export async function createAuditLog(data: {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}): Promise<AuditLog> {
  const log = auditRepo().create(data);
  return auditRepo().save(log);
}

/**
 * Retrieve paginated audit logs for administrators.
 */
export async function getAuditLogs(opts: {
  skip: number;
  take: number;
  userId?: string;
  resource?: string;
}): Promise<[AuditLog[], number]> {
  const qb = auditRepo()
    .createQueryBuilder("audit")
    .leftJoinAndSelect("audit.user", "u")
    .orderBy("audit.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  if (opts.userId) {
    qb.andWhere("audit.userId = :uid", { uid: opts.userId });
  }
  if (opts.resource) {
    qb.andWhere("audit.resource = :res", { res: opts.resource });
  }

  return qb.getManyAndCount();
}

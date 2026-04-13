import { AppDataSource } from "../../../../database/data-source";
import { ShipmentLog, LogVisibility } from "../entities/ShipmentLog";

/**
 * Logs a shipment activity for audit trailing.
 */
export async function logActivity(
  shipmentId: string,
  changedById: string | undefined,
  action: string,
  options: {
    previousStatus?: string;
    newStatus?: string;
    note?: string;
    emailSent?: boolean;
    visibility?: LogVisibility;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  } = {}
) {
  try {
    const logRepo = AppDataSource.getRepository(ShipmentLog);
    const log = logRepo.create({
      shipmentId,
      changedById,
      action,
      previousStatus: options.previousStatus,
      newStatus: options.newStatus,
      note: options.note,
      emailSent: options.emailSent || false,
      visibility: options.visibility || LogVisibility.INTERNAL,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: options.metadata || {},
    });
    await logRepo.save(log);
  } catch (err) {
    console.error("[logActivity] Failed to log activity:", err);
  }
}

import { AppDataSource } from "../../../../database/data-source";
import { ShipmentLog } from "../entities/ShipmentLog";

/**
 * Logs a shipment activity for audit trailing.
 */
export async function logActivity(
  shipmentId: string,
  userId: string | undefined,
  action: string,
  metadata: Record<string, any> = {}
) {
  try {
    const logRepo = AppDataSource.getRepository(ShipmentLog);
    const log = logRepo.create({
      shipmentId,
      userId,
      action,
      metadata,
    });
    await logRepo.save(log);
  } catch (err) {
    console.error("[logActivity] Failed to log activity:", err);
  }
}

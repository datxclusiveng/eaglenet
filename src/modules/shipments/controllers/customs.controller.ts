import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { CustomsClearance, CustomsStatus } from "../entities/CustomsClearance";
import { User } from "../../users/entities/User";
import { logActivity } from "../services/activity.service";
import { sanitizeUser } from "../../../utils/helpers";

const repo = () => AppDataSource.getRepository(CustomsClearance);

export async function updateCustomsStatus(req: Request, res: Response) {
  try {
    const shipmentId = req.params.shipmentId as string;
    const { status, remarks } = req.body;
    const user = (req as any).user as User;

    let clearance = await repo().findOneBy({ shipmentId });

    if (!clearance) {
      clearance = repo().create({ shipmentId, status, remarks, clearingAgentId: user.id });
    } else {
      clearance.status = status;
      clearance.remarks = remarks;
      if (status === CustomsStatus.RELEASED) {
        clearance.releasedAt = new Date();
      }
    }

    await repo().save(clearance);

    await logActivity(shipmentId, user.id, "customs_update", {
      newStatus: status,
      note: `Customs updated: ${status}. Remarks: ${remarks}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(clearance, "Customs clearance details updated.");
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function getCustomsDetail(req: Request, res: Response) {
  try {
    const shipmentId = req.params.shipmentId as string;

    let clearance = await repo().findOne({
      where: { shipmentId },
      relations: ["clearingAgent"]
    });

    // ─── Auto-initialize if shipment is in CUSTOMS status but no record exists ──
    if (!clearance) {
      // Check if the shipment actually exists and is in customs phase
      const shipmentRepo = AppDataSource.getRepository(
        (await import("../entities/Shipment")).Shipment
      );
      const shipment = await shipmentRepo.findOneBy({ id: shipmentId });

      if (!shipment) {
        return res.status(404).json({ status: "error", message: "Shipment not found." });
      }

      if (shipment.status !== (await import("../entities/Shipment")).ShipmentStatus.CUSTOMS) {
        return res.status(404).json({
          status: "error",
          message: "No customs record found. Shipment has not entered the customs phase yet.",
        });
      }

      // Shipment is in CUSTOMS but record was never created — initialize it now
      clearance = repo().create({
        shipmentId,
        status: CustomsStatus.PENDING_DOCUMENTS,
        remarks: "Auto-initialized on first access",
      });
      await repo().save(clearance);

      // Re-fetch with relations
      clearance = (await repo().findOne({ where: { shipmentId }, relations: ["clearingAgent"] }))!;
    }

    const safeClearance = {
      ...clearance,
      clearingAgent: clearance.clearingAgent ? sanitizeUser(clearance.clearingAgent) : null,
    };

    return (res as any).success(safeClearance);
  } catch (err) {
    console.error("[CustomsController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

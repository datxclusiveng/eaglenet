import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { CustomsClearance, CustomsStatus } from "../entities/CustomsClearance";
import { User } from "../../users/entities/User";
import { logActivity } from "../services/activity.service";

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

    return res.status(200).json({ status: "success", data: clearance });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function getCustomsDetail(req: Request, res: Response) {
  try {
    const shipmentId = req.params.shipmentId as string;
    const clearance = await repo().findOne({
      where: { shipmentId },
      relations: ["clearingAgent"]
    });

    if (!clearance) return res.status(404).json({ status: "error", message: "No customs record found." });

    return res.status(200).json({ status: "success", data: clearance });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

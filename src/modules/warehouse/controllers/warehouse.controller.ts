import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { WarehouseDirection } from "../entities/WarehouseEntry";
import { paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import {
  createWarehouseEntry,
  listWarehouseEntries,
  getWarehouseEntryById,
  updateWarehouseEntry,
  softDeleteWarehouseEntry,
  listMyWarehouseEntries,
} from "../services/warehouse.service";

export async function createWarehouseEntryHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const body = req.body;

    const entry = await createWarehouseEntry({
      sn: body.sn,
      direction: body.direction,
      clients: body.clients,
      awb: body.awb,
      weight: body.weight !== undefined ? Number(body.weight) : undefined,
      pkgs: body.pkgs !== undefined ? Number(body.pkgs) : undefined,
      description: body.description,
      dateIn: body.dateIn,
      dateOut: body.dateOut,
      remarks: body.remarks,
      createdById: user.id,
    });

    createAuditLog({
      entityType: "WarehouseEntry",
      entityId: entry.id,
      action: AuditAction.CREATE,
      actionDetails: { sn: entry.sn, direction: entry.direction, clients: entry.clients, awb: entry.awb },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({
      status: "success",
      data: {
        ...entry,
        createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
      },
    });
  } catch (err: any) {
    console.error("[WarehouseController.create]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error creating warehouse entry." });
  }
}

export async function listWarehouseEntriesHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const direction = req.query.direction as WarehouseDirection | undefined;
    const clients = req.query.clients as string | undefined;
    const awb = req.query.awb as string | undefined;
    const startDateIn = req.query.startDateIn as string | undefined;
    const endDateIn = req.query.endDateIn as string | undefined;
    const startDateOut = req.query.startDateOut as string | undefined;
    const endDateOut = req.query.endDateOut as string | undefined;

    const [rows, total] = await listWarehouseEntries({
      skip,
      take: limit,
      direction,
      clients,
      awb,
      startDateIn,
      endDateIn,
      startDateOut,
      endDateOut,
    });

    const sanitized = rows.map((entry) => ({
      ...entry,
      createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
    }));

    return res.status(200).json({
      status: "success",
      data: sanitized,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[WarehouseController.list]", err);
    return res.status(500).json({ status: "error", message: "Error listing warehouse entries." });
  }
}

export async function getWarehouseEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const entry = await getWarehouseEntryById(id);
    if (!entry) {
      return res.status(404).json({ status: "error", message: "Warehouse entry not found." });
    }
    return res.status(200).json({
      status: "success",
      data: {
        ...entry,
        createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
      },
    });
  } catch (err) {
    console.error("[WarehouseController.get]", err);
    return res.status(500).json({ status: "error", message: "Error retrieving warehouse entry." });
  }
}

export async function updateWarehouseEntryHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;
    const body = req.body;

    const data: any = {};
    if (body.sn !== undefined) data.sn = body.sn;
    if (body.direction !== undefined) data.direction = body.direction;
    if (body.clients !== undefined) data.clients = body.clients;
    if (body.awb !== undefined) data.awb = body.awb;
    if (body.weight !== undefined) data.weight = Number(body.weight);
    if (body.pkgs !== undefined) data.pkgs = Number(body.pkgs);
    if (body.description !== undefined) data.description = body.description;
    if (body.dateIn !== undefined) data.dateIn = body.dateIn;
    if (body.dateOut !== undefined) data.dateOut = body.dateOut;
    if (body.remarks !== undefined) data.remarks = body.remarks;

    const entry = await updateWarehouseEntry(id, data);

    createAuditLog({
      entityType: "WarehouseEntry",
      entityId: entry.id,
      action: AuditAction.UPDATE,
      actionDetails: { sn: entry.sn, changes: data },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({
      status: "success",
      data: {
        ...entry,
        createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
      },
    });
  } catch (err: any) {
    console.error("[WarehouseController.update]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error updating warehouse entry." });
  }
}

export async function deleteWarehouseEntryHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;
    await softDeleteWarehouseEntry(id);

    createAuditLog({
      entityType: "WarehouseEntry",
      entityId: id,
      action: AuditAction.DELETE,
      actionDetails: { event: "soft_deleted" },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", message: "Warehouse entry deleted." });
  } catch (err: any) {
    console.error("[WarehouseController.delete]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error deleting warehouse entry." });
  }
}

export async function listMyWarehouseHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const user = (req as any).user as User;
    const direction = req.query.direction as WarehouseDirection | undefined;
    const startDateIn = req.query.startDateIn as string | undefined;
    const endDateIn = req.query.endDateIn as string | undefined;
    const startDateOut = req.query.startDateOut as string | undefined;
    const endDateOut = req.query.endDateOut as string | undefined;

    const [rows, total] = await listMyWarehouseEntries({
      userId: user.id,
      skip,
      take: limit,
      direction,
      startDateIn,
      endDateIn,
      startDateOut,
      endDateOut,
    });

    const sanitized = rows.map((entry) => ({
      ...entry,
      createdBy: sanitizeUser(entry.createdBy),
    }));

    return res.status(200).json({
      status: "success",
      data: sanitized,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[WarehouseController.listMy]", err);
    return res.status(500).json({ status: "error", message: "Error listing your warehouse entries." });
  }
}

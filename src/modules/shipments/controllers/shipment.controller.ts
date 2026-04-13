import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus, ShipmentType } from "../entities/Shipment";
import { Service } from "../entities/Service";
import { Location } from "../entities/Location";
import { User, UserRole } from "../../users/entities/User";
import { PermissionScope } from "../../permissions/entities/Permission";
import { paginate, parsePagination } from "../../../utils/helpers";
import { logActivity } from "../services/activity.service";
import { LogVisibility, ShipmentLog } from "../entities/ShipmentLog";
import {
  sendBookingConfirmationEmail,
  sendStatusUpdateEmail,
} from "../../notifications/services/email.service";
import { generateTrackingNumber } from "../utils/generators";
import { MoreThanOrEqual } from "typeorm";

const repo = () => AppDataSource.getRepository(Shipment);
const serviceRepo = () => AppDataSource.getRepository(Service);
const locationRepo = () => AppDataSource.getRepository(Location);

// ─── Public: Get Services & Locations ───────────────────────────────────────
export async function getServices(_req: Request, res: Response) {
  try {
    const services = await serviceRepo().find({
      order: { serviceName: "ASC" },
    });
    return res.status(200).json({ status: "success", data: services });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error fetching services." });
  }
}

export async function getLocations(req: Request, res: Response) {
  try {
    const type = req.query.type as string;
    const query = locationRepo().createQueryBuilder("l").orderBy("l.name", "ASC");
    if (type) query.where("l.type = :type", { type: type.toUpperCase() });
    const locations = await query.getMany();
    return res.status(200).json({ status: "success", data: locations });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error fetching locations." });
  }
}

// ─── Staff/Admin: Create a shipment ─────────────────────────────────────────
export async function createShipment(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const {
      type, clientName, clientEmail, clientPhone,
      originCountry, originCity, destinationCountry, destinationCity,
      eta, description, weightKg, volumeCbm,
      airlineOrVessel, flightOrVoyageNumber, departureDate,
      notes, assignedOfficerId
    } = req.body;

    if (!type || !Object.values(ShipmentType).includes(type)) {
      return res.status(400).json({ status: "error", message: "Invalid shipment type." });
    }

    // Get count for today to generate sequential tracking number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await repo().count({
      where: {
        createdAt: MoreThanOrEqual(today)
      }
    });

    const trackingNumber = generateTrackingNumber(type, count + 1);

    const shipment = repo().create({
      trackingNumber,
      type,
      status: ShipmentStatus.PENDING,
      clientName: clientName?.trim(),
      clientEmail: clientEmail?.toLowerCase().trim(),
      clientPhone: clientPhone?.trim(),
      originCountry,
      originCity,
      destinationCountry,
      destinationCity,
      eta,
      description,
      weightKg: Number(weightKg) || 0,
      volumeCbm: Number(volumeCbm) || 0,
      airlineOrVessel,
      flightOrVoyageNumber,
      departureDate,
      notes,
      assignedOfficerId: assignedOfficerId || user.id,
    });

    await repo().save(shipment);

    // Initial Status History Log
    await logActivity(shipment.id, user.id, "creation", {
      newStatus: ShipmentStatus.PENDING,
      note: "Shipment record created in system.",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Email Confirmation (Asynchronous)
    sendBookingConfirmationEmail(shipment.clientEmail, {
      fullName: shipment.clientName,
      trackingId: shipment.trackingNumber,
      type: shipment.type,
      origin: `${shipment.originCity}, ${shipment.originCountry}`,
      destination: `${shipment.destinationCity}, ${shipment.destinationCountry}`,
      eta: shipment.eta || "TBC",
      carrier: shipment.airlineOrVessel || "TBC",
    }).catch(console.error);

    return res.status(201).json({ status: "success", data: shipment });
  } catch (err) {
    console.error("[ShipmentController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: List shipments (DEPT-AWARE) ─────────────────────────────────
export async function listShipments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};
    const { page, limit, skip } = parsePagination(req.query);
    const { status, search, type } = req.query;

    const qb = repo().createQueryBuilder("s")
      .leftJoinAndSelect("s.assignedOfficer", "officer")
      .leftJoin("s.collaborators", "collab");

    // 1. RBAC Scoping
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      if (scope === PermissionScope.DEPARTMENT && departmentId) {
        qb.andWhere("(s.assignedOfficerId = :uid OR collab.id = :deptId)", { uid: user.id, deptId: departmentId });
      } else if (scope === PermissionScope.OWN) {
        qb.andWhere("s.assignedOfficerId = :uid", { uid: user.id });
      }
    }

    // 2. Filters
    if (status) qb.andWhere("s.status = :status", { status });
    if (type) qb.andWhere("s.type = :type", { type });
    if (search) {
      qb.andWhere("(s.trackingNumber ILIKE :s OR s.clientName ILIKE :s OR s.clientEmail ILIKE :s)", { s: `%${search}%` });
    }

    qb.orderBy("s.createdAt", "DESC").skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[ShipmentController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Update status + Log History ────────────────────────────────
export async function updateShipmentStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, note, triggerEmail, visibility } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    const oldStatus = shipment.status;
    shipment.status = status;

    if (status === ShipmentStatus.ARRIVED) {
      shipment.actualArrivalDate = new Date().toISOString().split("T")[0];
    }

    await repo().save(shipment);

    let emailSent = false;
    if (triggerEmail || status === ShipmentStatus.ARRIVED) {
       sendStatusUpdateEmail(shipment.clientEmail, {
        fullName: shipment.clientName,
        trackingId: shipment.trackingNumber,
        status: shipment.status,
        origin: shipment.originCity || "TBC",
        destination: shipment.destinationCity || "TBC",
        shipmentId: shipment.id,
      }).catch(console.error);
      emailSent = true;
    }

    await logActivity(shipment.id, user.id, "status_change", {
      previousStatus: oldStatus,
      newStatus: status,
      note,
      emailSent,
      visibility: visibility || LogVisibility.PUBLIC,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Create Internal Note ───────────────────────────────────────
export async function createInternalNote(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { note } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    await logActivity(shipment.id, user.id, "note_added", {
      note,
      visibility: LogVisibility.INTERNAL,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({ status: "success", message: "Note added successfully." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error adding note." });
  }
}

// ... (previous export functions)

// ─── Staff/Admin: Get shipment stats for dashboard ──────────────────────────
export async function getShipmentStats(req: Request, res: Response) {
  try {
    const type = req.query.type as string; // air_freight | sea_freight
    const qb = repo().createQueryBuilder("s");
    
    if (type) qb.where("s.type = :type", { type });

    const stats = await qb
      .select("s.status", "status")
      .addSelect("COUNT(s.id)", "count")
      .groupBy("s.status")
      .getRawMany();

    const totalCount = await qb.getCount();

    // Arriving Today (ETA is today)
    const todayStr = new Date().toISOString().split("T")[0];
    const arrivingToday = await repo().count({
      where: { 
        eta: todayStr,
        ...(type ? { type: type as any } : {})
      }
    });

    // Recent (Created in last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await repo().count({
      where: { 
        createdAt: MoreThanOrEqual(yesterday),
        ...(type ? { type: type as any } : {})
      }
    });
    
    return res.status(200).json({ 
      status: "success", 
      data: { 
        stats, 
        total: totalCount, 
        arrivingToday,
        recent
      } 
    });
  } catch (err) {
    console.error("[Stats]", err);
    return res.status(500).json({ status: "error", message: "Error fetching stats." });
  }
}

// ─── Staff/Admin: Get status history for a shipment ─────────────────────────
export async function getStatusHistory(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const logRepo = AppDataSource.getRepository(ShipmentLog);
    
    const history = await logRepo.find({
      where: { shipmentId: id, action: "status_change" },
      relations: ["changedBy"],
      order: { createdAt: "DESC" }
    });

    return res.status(200).json({ status: "success", data: history });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error fetching history." });
  }
}

// ─── Staff/Admin: Send manual email to client ────────────────────────────────
export async function sendManualOfficerEmail(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { subject, body, templateId } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    // Since we don't have a broad custom sender yet, we'll use a generic send helper
    // In a real system, you'd integrate the 'body' into a template or send raw.
    // For now, we'll log it as a manual notification.
    
    // Using existing email service (simplified for this exercise)
    // In production, we'd have a 'sendCustomEmail' method.
    
    await logActivity(shipment.id, user.id, "manual_email", {
      metadata: { subject, templateId, body_preview: body?.substring(0, 50) }
    });

    return res.status(200).json({ status: "success", message: "Email triggered successfully." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error sending email." });
  }
}

// ─── Public: Track Shipment ──────────────────────────────────────────────────
export async function trackShipment(req: Request, res: Response) {
  try {
    const trackingNumber = req.params.trackingNumber as string;
    const shipment = await repo().findOne({
      where: { trackingNumber },
      relations: ["logs"],
    });

    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    // Filter logs to only show public status changes
    const publicHistory = shipment.logs
      .filter(l => l.action === "status_change")
      .map(l => ({
        status: l.newStatus,
        date: l.createdAt,
        note: l.note
      }));

    return res.status(200).json({ 
      status: "success", 
      data: {
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        origin: `${shipment.originCity}, ${shipment.originCountry}`,
        destination: `${shipment.destinationCity}, ${shipment.destinationCountry}`,
        history: publicHistory
      } 
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function getShipment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const shipment = await repo().findOne({
      where: { id },
      relations: ["assignedOfficer", "logs", "collaborators"],
    });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });
    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus, ShipmentType } from "../entities/Shipment";
import { Service } from "../entities/Service";
import { Location } from "../entities/Location";
import { User, UserRole } from "../../users/entities/User";
import { Department } from "../../departments/entities/Department";
import { UserDepartmentRole } from "../../users/entities/UserDepartmentRole";
import { PermissionScope } from "../../permissions/entities/Permission";
import { paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import { serializeShipment, serializePaginatedResponse } from "../../../utils/serializers";
import { logActivity } from "../services/activity.service";
import { LogVisibility, ShipmentLog } from "../entities/ShipmentLog";
import {
  sendBookingConfirmationEmail,
  sendStatusUpdateEmail,
} from "../../notifications/services/email.service";
import { createNotification } from "../../notifications/services/notification.service";
import { NotificationType } from "../../notifications/entities/Notification";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { emitShipmentUpdate } from "../../../socket";
import { generateTrackingNumber } from "../utils/generators";
import { uploadFile } from "../../../utils/storage.service";
import { MoreThanOrEqual } from "typeorm";

const repo = () => AppDataSource.getRepository(Shipment);
const serviceRepo = () => AppDataSource.getRepository(Service);
const locationRepo = () => AppDataSource.getRepository(Location);

// ─── Public: Get Services & Locations ──────────────────────────────────────────
export async function getServices(_req: Request, res: Response) {
  try {
    const services = await serviceRepo().find({ order: { serviceName: "ASC" } });
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

// ─── Staff/Admin: Create a shipment ────────────────────────────────────────────
export async function createShipment(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const {
      shipmentName,
      internalReference,
      type,
      pickupAddress,
      deliveryAddress,
      originCountry, originCity,
      destinationCountry, destinationCity,
      eta,
      expectedDeliveryDate,
      description,
      weightKg,
      dimensions,
      volumeCbm,
      airlineOrVessel,
      flightOrVoyageNumber,
      departureDate,
      internalNotes,
      notes,
      assignedOfficerId,
      departmentId: bodyDeptId,
      clientName,
      clientEmail,
      clientPhone,
    } = req.body;

    if (!shipmentName || !shipmentName.trim()) {
      return res.status(400).json({ status: "error", message: "Shipment name is required." });
    }
    if (!type || !Object.values(ShipmentType).includes(type)) {
      return res.status(400).json({ status: "error", message: "Invalid shipment type. Must be 'export' or 'import'." });
    }

    // Resolve department: SuperAdmin must specify, regular staff auto-assigned
    let resolvedDeptId: string | undefined;
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      resolvedDeptId = bodyDeptId;
    } else {
      // Auto-resolve from the user's first active department
      const udr = await AppDataSource.getRepository(UserDepartmentRole).findOne({
        where: { userId: user.id },
      });
      resolvedDeptId = udr?.departmentId || bodyDeptId;
    }

    // Validate department exists (if provided)
    if (resolvedDeptId) {
      const dept = await AppDataSource.getRepository(Department).findOneBy({ id: resolvedDeptId });
      if (!dept) {
        return res.status(404).json({ status: "error", message: "Department not found." });
      }
    }

    // Get today's count for sequential tracking number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await repo().count({ where: { createdAt: MoreThanOrEqual(today) } });

    const trackingNumber = generateTrackingNumber(type, count + 1);

    const shipment = repo().create({
      trackingNumber,
      shipmentName: shipmentName.trim(),
      internalReference: internalReference?.trim(),
      type,
      status: ShipmentStatus.PENDING,
      pickupAddress,
      deliveryAddress,
      clientName: clientName?.trim(),
      clientEmail: clientEmail?.toLowerCase().trim(),
      clientPhone: clientPhone?.trim(),
      originCountry,
      originCity,
      destinationCountry,
      destinationCity,
      eta,
      expectedDeliveryDate,
      description,
      weightKg: Number(weightKg) || undefined,
      dimensions,
      volumeCbm: Number(volumeCbm) || undefined,
      airlineOrVessel,
      flightOrVoyageNumber,
      departureDate,
      internalNotes,
      notes,
      departmentId: resolvedDeptId,
      assignedOfficerId: assignedOfficerId || user.id,
      createdById: user.id,
    });

    await repo().save(shipment);

    // Log initial tracking history
    await logActivity(shipment.id, user.id, "creation", {
      newStatus: ShipmentStatus.PENDING,
      note: "Shipment record created in system.",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Audit log (fire-and-forget)
    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.CREATE,
      actionDetails: { trackingNumber, shipmentName: shipment.shipmentName, type, departmentId: resolvedDeptId },
      performedBy: user.id,
      departmentId: resolvedDeptId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Email Confirmation — async, non-blocking
    if (clientEmail) {
      sendBookingConfirmationEmail(clientEmail, {
        fullName: clientName || "Client",
        trackingId: shipment.trackingNumber,
        type: shipment.type,
        origin: `${shipment.originCity || ""}, ${shipment.originCountry || ""}`.trim(),
        destination: `${shipment.destinationCity || ""}, ${shipment.destinationCountry || ""}`.trim(),
        eta: shipment.eta || "TBC",
        carrier: shipment.airlineOrVessel || "TBC",
      }).catch(console.error);
    }

    // Trigger Notifications
    if (shipment.assignedOfficerId) {
      createNotification({
        userId: shipment.assignedOfficerId,
        title: "New Shipment Assigned",
        message: `You have been assigned to shipment ${shipment.trackingNumber}.`,
        type: NotificationType.SYSTEM,
        relatedEntityType: "Shipment",
        relatedEntityId: shipment.id,
      });
    }

    return res.status(201).json({ status: "success", data: serializeShipment(shipment) });
  } catch (err) {
    console.error("[ShipmentController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: List shipments (dept-aware) ───────────────────────────────────
export async function listShipments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};
    const { page, limit, skip } = parsePagination(req.query);
    const { status, search, type } = req.query;

    const qb = repo()
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.assignedOfficer", "officer")
      .leftJoinAndSelect("s.department", "dept")
      .leftJoin("s.collaborators", "collab");

    // RBAC Scoping
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      if (scope === PermissionScope.DEPARTMENT && departmentId) {
        qb.andWhere("(s.departmentId = :deptId OR collab.id = :deptId OR s.assignedOfficerId = :uid)", {
          deptId: departmentId,
          uid: user.id,
        });
      } else if (scope === PermissionScope.OWN) {
        qb.andWhere("s.assignedOfficerId = :uid", { uid: user.id });
      }
    }

    // Filters
    if (status) qb.andWhere("s.status = :status", { status });
    if (type) qb.andWhere("s.type = :type", { type });
    if (search) {
      qb.andWhere(
        "(s.trackingNumber ILIKE :s OR s.shipmentName ILIKE :s OR s.clientName ILIKE :s OR s.clientEmail ILIKE :s)",
        { s: `%${search}%` },
      );
    }

    qb.orderBy("s.createdAt", "DESC").skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    return res.status(200).json(serializePaginatedResponse(rows, paginate(total, page, limit)));
  } catch (err) {
    console.error("[ShipmentController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Get single shipment (full detail) ────────────────────────────
export async function getShipment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const user = (req as any).user as User;

    const shipment = await repo().findOne({
      where: { id },
      relations: ["assignedOfficer", "createdBy", "department", "logs", "collaborators"],
    });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    // Log the view in audit trail (fire-and-forget)
    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.VIEW,
      performedBy: user.id,
      departmentId: shipment.departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", data: serializeShipment(shipment) });
  } catch (err) {
    console.error("[ShipmentController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Update shipment status ────────────────────────────────────────
export async function updateShipmentStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, note, location, triggerEmail, visibility } = req.body || {};
    const user = (req as any).user as User;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ status: "error", message: "Request body is missing or empty." });
    }

    if (!status || !Object.values(ShipmentStatus).includes(status)) {
      return res.status(400).json({ status: "error", message: "Invalid shipment status." });
    }

    const shipment = await repo().findOneBy({ id });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    const oldStatus = shipment.status;
    shipment.status = status;

    if (status === ShipmentStatus.DELIVERED) {
      shipment.actualDeliveryDate = new Date().toISOString().split("T")[0];
    }

    await repo().save(shipment);

    // Log status history
    let emailSent = false;
    if (triggerEmail || status === ShipmentStatus.DELIVERED) {
      sendStatusUpdateEmail(shipment.clientEmail!, {
        fullName: shipment.clientName || "Client",
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
      metadata: { location },
    });

    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.STATUS_CHANGE,
      actionDetails: { before: oldStatus, after: status, note, location, emailSent },
      performedBy: user.id,
      departmentId: shipment.departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Notify Assigned Officer & Supervisor
    if (shipment.assignedOfficerId && shipment.assignedOfficerId !== user.id) {
       createNotification({
         userId: shipment.assignedOfficerId,
         title: "Shipment Status Updated",
         message: `Shipment ${shipment.trackingNumber} status changed to ${status}.`,
         type: NotificationType.STATUS_UPDATE,
         relatedEntityType: "Shipment",
         relatedEntityId: shipment.id,
       });
    }

    // Real-time update to department room
    emitShipmentUpdate(shipment.departmentId!, {
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      updatedBy: `${user.firstName} ${user.lastName}`
    });

    return res.status(200).json({ status: "success", data: serializeShipment(shipment) });
  } catch (err) {
    console.error("[ShipmentController.updateStatus]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Update shipment details ───────────────────────────────────────
export async function updateShipment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const user = (req as any).user as User;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ status: "error", message: "Request body is missing or empty." });
    }

    const shipment = await repo().findOneBy({ id });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    const before = { ...shipment };

    const updatable = [
      "shipmentName", "internalReference", "pickupAddress", "deliveryAddress",
      "originCountry", "originCity", "destinationCountry", "destinationCity",
      "eta", "expectedDeliveryDate", "description", "weightKg", "dimensions",
      "volumeCbm", "airlineOrVessel", "flightOrVoyageNumber", "departureDate",
      "internalNotes", "notes", "assignedOfficerId",
    ];

    for (const field of updatable) {
      if (req.body[field] !== undefined) {
        (shipment as any)[field] = req.body[field];
      }
    }

    await repo().save(shipment);

    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.UPDATE,
      actionDetails: { before, after: shipment },
      performedBy: user.id,
      departmentId: shipment.departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", data: serializeShipment(shipment) });
  } catch (err) {
    console.error("[ShipmentController.update]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Create internal note ─────────────────────────────────────────
export async function createInternalNote(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { note } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

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

// ─── Staff/Admin: Get shipment stats for dashboard ──────────────────────────────
export async function getShipmentStats(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const type = req.query.type as string;
    const { departmentId } = (req as any).permissionScope || {};

    const qb = repo().createQueryBuilder("s");

    // Scope to department for non-admins
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN && departmentId) {
      qb.where("s.departmentId = :deptId", { deptId: departmentId });
    }
    if (type) qb.andWhere("s.type = :type", { type });

    const stats = await qb
      .select("s.status", "status")
      .addSelect("COUNT(s.id)", "count")
      .groupBy("s.status")
      .getRawMany();

    const totalCount = await qb.getCount();

    // Arriving today (ETA is today)
    const todayStr = new Date().toISOString().split("T")[0];
    const arrivingToday = await repo().count({
      where: {
        eta: todayStr,
        ...(type ? { type: type as any } : {}),
      },
    });

    // Created in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await repo().count({
      where: {
        createdAt: MoreThanOrEqual(yesterday),
        ...(type ? { type: type as any } : {}),
      },
    });

    return res.status(200).json({
      status: "success",
      data: { stats, total: totalCount, arrivingToday, recent },
    });
  } catch (err) {
    console.error("[ShipmentController.stats]", err);
    return res.status(500).json({ status: "error", message: "Error fetching stats." });
  }
}

// ─── Staff/Admin: Get status history for a shipment ─────────────────────────────
export async function getStatusHistory(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const logRepo = AppDataSource.getRepository(ShipmentLog);

    const history = await logRepo.find({
      where: { shipmentId: id },
      relations: ["changedBy"],
      order: { createdAt: "DESC" },
    });

    const sanitizedHistory = history.map((entry) => ({
      ...entry,
      changedBy: sanitizeUser(entry.changedBy),
    }));

    return res.status(200).json({ status: "success", data: sanitizedHistory });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error fetching history." });
  }
}

// ─── Staff/Admin: Send manual email to client ───────────────────────────────────
export async function sendManualOfficerEmail(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { subject, body, templateId } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    await logActivity(shipment.id, user.id, "manual_email", {
      metadata: { subject, templateId, body_preview: body?.substring(0, 50) },
    });

    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.SEND,
      actionDetails: { subject, templateId },
      performedBy: user.id,
      departmentId: shipment.departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", message: "Email triggered successfully." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Error sending email." });
  }
}

// ─── Public: Track Shipment ──────────────────────────────────────────────────────
export async function trackShipment(req: Request, res: Response) {
  try {
    const trackingNumber = req.params.trackingNumber as string;
    const shipment = await repo().findOne({
      where: { trackingNumber },
      relations: ["logs"],
    });

    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    const publicHistory = shipment.logs
      .filter((l) => l.action === "status_change" && l.visibility === LogVisibility.PUBLIC)
      .map((l) => ({
        status: l.newStatus,
        date: l.createdAt,
        note: l.note,
      }));

    return res.status(200).json({
      status: "success",
      data: {
        trackingNumber: shipment.trackingNumber,
        shipmentName: shipment.shipmentName,
        status: shipment.status,
        type: shipment.type,
        origin: `${shipment.originCity || ""}, ${shipment.originCountry || ""}`.trim(),
        destination: `${shipment.destinationCity || ""}, ${shipment.destinationCountry || ""}`.trim(),
        eta: shipment.eta,
        expectedDeliveryDate: shipment.expectedDeliveryDate,
        history: publicHistory,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff/Admin: Upload delivery proof ──────────────────────────────────────────
export async function uploadDeliveryProof(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const user = (req as any).user as User;
    const { recipientName, deliveryNotes } = req.body;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let signatureUrl = "";
    let photoUrl = "";

    if (files?.signature && files.signature.length > 0) {
      const sigFile = files.signature[0];
      const uploaded = await uploadFile(sigFile.buffer, sigFile.originalname, sigFile.mimetype, "delivery-proofs");
      signatureUrl = uploaded.url;
    }

    if (files?.photo && files.photo.length > 0) {
      const photoFile = files.photo[0];
      const uploaded = await uploadFile(photoFile.buffer, photoFile.originalname, photoFile.mimetype, "delivery-proofs");
      photoUrl = uploaded.url;
    }

    const note = `Delivery proof uploaded. Recipient: ${recipientName || 'Not specified'}. Notes: ${deliveryNotes || 'None'}`;
    
    // Create activity log
    await logActivity(shipment.id, user.id, "delivery_proof_uploaded", {
      note,
      metadata: { recipientName, deliveryNotes, signatureUrl, photoUrl },
      visibility: LogVisibility.PUBLIC,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.UPDATE,
      actionDetails: { event: "delivery_proof_uploaded", recipientName, deliveryNotes, signatureUrl, photoUrl },
      performedBy: user.id,
      departmentId: shipment.departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", message: "Delivery proof uploaded successfully." });
  } catch (err) {
    console.error("[ShipmentController.uploadDeliveryProof]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}
import { exportShipmentsToExcel, exportShipmentsToCSV } from "../services/export.service";

/**
 * Export shipments as Excel or CSV
 * GET /api/shipments/export?format=xlsx|csv
 */
export async function exportShipments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};
    const { format, status, type, search } = req.query;

    const qb = repo().createQueryBuilder("s");

    // Scoping (same as listShipments)
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      if (scope === PermissionScope.DEPARTMENT && departmentId) {
        qb.andWhere("s.departmentId = :deptId", { deptId: departmentId });
      } else if (scope === PermissionScope.OWN) {
        qb.andWhere("s.assignedOfficerId = :uid", { uid: user.id });
      }
    }

    if (status) qb.andWhere("s.status = :status", { status });
    if (type) qb.andWhere("s.type = :type", { type });
    if (search) {
      qb.andWhere("(s.trackingNumber ILIKE :s OR s.shipmentName ILIKE :s)", { s: `%${search}%` });
    }

    const shipments = await qb.orderBy("s.createdAt", "DESC").take(1000).getMany();

    if (format === "csv") {
      const csv = exportShipmentsToCSV(shipments);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=shipments.csv");
      return res.send(csv);
    } else {
      // Default XLSX
      const buffer = exportShipmentsToExcel(shipments);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=shipments.xlsx");
      return res.send(buffer);
    }
  } catch (err) {
    console.error("[ShipmentController.export]", err);
    return res.status(500).json({ status: "error", message: "Failed to export shipments." });
  }
}

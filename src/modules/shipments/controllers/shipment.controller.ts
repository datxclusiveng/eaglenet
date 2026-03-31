import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus, CreationSource } from "../entities/Shipment";
import { Service } from "../entities/Service";
import { Location } from "../entities/Location";
import { Tracking } from "../entities/Tracking";
import { User, UserRole } from "../../users/entities/User";
import { PermissionScope } from "../../permissions/entities/Permission";
import { generateEglId, paginate, parsePagination } from "../../../utils/helpers";
import { logActivity } from "../services/activity.service";
import {
  sendBookingConfirmationEmail,
  sendStatusUpdateEmail,
  sendPriceQuoteEmail,
} from "../../notifications/services/email.service";
import { sendPushNotification } from "../../notifications/services/push-notification.service";

const repo = () => AppDataSource.getRepository(Shipment);
const trackingRepo = () => AppDataSource.getRepository(Tracking);
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

// ─── Customer/Staff: Create a booking or record ──────────────────────────────
export async function createShipment(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const {
      serviceId, origin, destination, arrivalDate, fullName, email,
      phoneNumber, pickupAddress, pickupCity, deliveryAddress,
      destinationCity, preferredPickupDate, preferredPickupTime,
      specialRequirements, departmentId, dynamicFields,
      creationSource, isExternal
    } = req.body;

    const source = user.role !== UserRole.CUSTOMER 
      ? (creationSource || CreationSource.STAFF) 
      : CreationSource.CUSTOMER;

    const service = await serviceRepo().findOneBy({ id: serviceId });
    if (!service) return res.status(404).json({ status: "error", message: "Service not found." });

    const shipment = repo().create({
      shippingId: generateEglId("SHIP"),
      trackingId: `EGLN${Math.floor(10000000 + Math.random() * 90000000)}`,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      pickupAddress: pickupAddress || origin,
      pickupCity: pickupCity || origin,
      deliveryAddress: deliveryAddress || destination,
      destinationCity: destinationCity || destination,
      preferredPickupDate: preferredPickupDate || new Date().toISOString().split("T")[0],
      preferredPickupTime: preferredPickupTime || "",
      specialRequirements,
      status: ShipmentStatus.ORDER_PLACED,
      amount: 0,
      serviceId: service.id,
      origin,
      destination,
      arrivalDate,
      userId: user?.id,
      departmentId,
      dynamicFields: dynamicFields || {},
      creationSource: source,
      isExternal: isExternal === true || isExternal === "true",
    });

    await repo().save(shipment);

    // Initial Tracking & Activity Log
    await trackingRepo().save(trackingRepo().create({
      shipmentId: shipment.id,
      checkpoint: "Order Received & Awaiting Review",
      location: origin,
      status: ShipmentStatus.ORDER_PLACED,
      date: new Date(),
    }));

    await logActivity(shipment.id, user?.id, "created", { 
      service: service.serviceName,
      departmentId 
    });

    // Email...
    sendBookingConfirmationEmail(shipment.email, {
      fullName: shipment.fullName,
      shippingId: shipment.shippingId,
      trackingId: shipment.trackingId,
      serviceName: service.serviceName,
      origin: shipment.origin || shipment.pickupCity,
      destination: shipment.destination || shipment.destinationCity,
      arrivalDate: arrivalDate || "TBC",
      amount: 0,
    }).catch(console.error);

    return res.status(201).json({ status: "success", data: shipment });
  } catch (err) {
    console.error("[ShipmentController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: List all shipments (POLICY-AWARE) ─────────────────────────────────
export async function listShipments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};
    const { page, limit, skip } = parsePagination(req.query);
    const { status, search, city } = req.query;

    const qb = repo().createQueryBuilder("s")
      .leftJoinAndSelect("s.user", "u")
      .leftJoinAndSelect("s.service", "service")
      .leftJoin("s.collaborators", "collab");

    // 1. Policy Scoping
    if (user.role !== UserRole.SUPERADMIN) {
      if (scope === PermissionScope.DEPARTMENT) {
        qb.andWhere("(s.departmentId = :deptId OR collab.id = :deptId)", { deptId: departmentId });
      } else if (scope === PermissionScope.OWN) {
        qb.andWhere("s.userId = :uid", { uid: user.id });
      }
    }

    // 2. Filters
    if (status) qb.andWhere("s.status = :status", { status });
    if (search) {
      qb.andWhere("(s.trackingId ILIKE :s OR s.fullName ILIKE :s OR s.email ILIKE :s)", { s: `%${search}%` });
    }
    if (city) {
      qb.andWhere("(s.pickupCity ILIKE :c OR s.destinationCity ILIKE :c)", { c: `%${city}%` });
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

// ─── Admin: Update shipment status + Activity Logging ────────────────────────
export async function updateShipmentStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, packageDetails, weight, comment } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOne({ where: { id }, relations: ["user"] });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    const oldStatus = shipment.status;
    shipment.status = status;
    if (packageDetails !== undefined) shipment.packageDetails = packageDetails;
    if (weight !== undefined) shipment.weight = Number(weight);

    await repo().save(shipment);

    // Forensic Audit
    await logActivity(shipment.id, user.id, "status_updated", {
      old_status: oldStatus,
      new_status: status,
      comment
    });

    // Notify customer
    sendStatusUpdateEmail(shipment.email, {
      fullName: shipment.fullName,
      trackingId: shipment.trackingId,
      status: shipment.status,
      pickupCity: shipment.pickupCity,
      destinationCity: shipment.destinationCity,
    }).catch(console.error);

    // Push Notif
    sendPushNotification(shipment.userId || "", "Shipment Update 📦", `Your shipment ${shipment.trackingId} status is now: ${shipment.status}`, "SHIPMENT", `/shipments/${shipment.id}`).catch(console.error);


    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Assign Price + Activity Logging ─────────────────────────────────
export async function assignShipmentPrice(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { amount } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    shipment.amount = Number(amount);
    shipment.status = ShipmentStatus.PENDING_CONFIRMATION;
    await repo().save(shipment);

    await logActivity(shipment.id, user.id, "price_assigned", { amount });

    sendPriceQuoteEmail(shipment.email, {
      fullName: shipment.fullName,
      trackingId: shipment.trackingId,
      amount: shipment.amount,
    }).catch(console.error);

    // Push Notif
    sendPushNotification(user?.id || "", "Order Placed! 🎉", `Your shipment ${shipment.trackingId} is now under review.`, "SHIPMENT", `/shipments/${shipment.id}`).catch(console.error);


    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Public: Track Shipment ──────────────────────────────────────────────────
export async function trackShipment(req: Request, res: Response) {
  try {
    const trackingId = req.params.trackingId as string;
    const shipment = await repo().findOne({
      where: { trackingId },
      relations: ["trackingUpdates", "service", "logs"],
    });

    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    // Sort tracking
    shipment.trackingUpdates.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Helper/Single ───
export async function getShipment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const shipment = await repo().findOne({
      where: { id },
      relations: ["user", "service", "trackingUpdates", "payments", "logs", "collaborators"],
    });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });
    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function myShipments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);
    const [rows, total] = await repo().findAndCount({
      where: { userId: user.id },
      order: { createdAt: "DESC" },
      skip, take: limit
    });
    return res.status(200).json({ status: "success", data: rows, meta: paginate(total, page, limit) });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function addTrackingCheckpoint(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { checkpoint, location, status } = req.body;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) return res.status(404).json({ status: "error", message: "Shipment not found." });

    const tracking = trackingRepo().create({
      shipmentId: shipment.id,
      checkpoint,
      location,
      status,
      date: new Date(),
    });

    await trackingRepo().save(tracking);
    shipment.status = status;
    await repo().save(shipment);

    await logActivity(shipment.id, user.id, "checkpoint_added", { checkpoint, status });

    return res.status(201).json({ status: "success", data: tracking });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

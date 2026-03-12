import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Shipment, ShipmentStatus } from "../entities/Shipment";
import { Service } from "../entities/Service";
import { Location } from "../entities/Location";
import { Tracking } from "../entities/Tracking";
import { User } from "../entities/User";
import { generateEglId, paginate, parsePagination } from "../utils/helpers";
import {
  sendBookingConfirmationEmail,
  sendStatusUpdateEmail,
  sendPriceQuoteEmail,
} from "../services/email.service";

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
    console.error("[ShipmentController.getServices]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Error fetching services." });
  }
}

export async function getLocations(req: Request, res: Response) {
  try {
    const type = req.query.type as string; // AIRPORT or SEAPORT
    const query = locationRepo()
      .createQueryBuilder("l")
      .orderBy("l.name", "ASC");
    if (type) {
      query.where("l.type = :type", { type: type.toUpperCase() });
    }
    const locations = await query.getMany();
    return res.status(200).json({ status: "success", data: locations });
  } catch (err) {
    console.error("[ShipmentController.getLocations]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Error fetching locations." });
  }
}

// ─── Customer: Create a booking ───────────────────────────────────────────────

export async function createShipment(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const {
      serviceId,
      origin,
      destination,
      arrivalDate,
      fullName,
      email,
      phoneNumber,
      pickupAddress,
      pickupCity,
      deliveryAddress,
      destinationCity,
      preferredPickupDate,
      preferredPickupTime,
      specialRequirements,
    } = req.body;

    const required = [
      "serviceId",
      "origin",
      "destination",
      "fullName",
      "email",
      "phoneNumber",
    ];

    const missing = required.filter((k) => !req.body[k]);
    if (missing.length) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const service = await serviceRepo().findOneBy({ id: serviceId });
    if (!service) {
      return res
        .status(404)
        .json({ status: "error", message: "Service not found." });
    }

    const shipment = repo().create({
      shippingId: generateEglId("SHIP"),
      trackingId: `EGLN${Math.floor(10000000 + Math.random() * 90000000)}`, // EGLN12345678 format
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      pickupAddress: pickupAddress?.trim() || origin,
      pickupCity: pickupCity?.trim() || origin,
      deliveryAddress: deliveryAddress?.trim() || destination,
      destinationCity: destinationCity?.trim() || destination,
      preferredPickupDate:
        preferredPickupDate || new Date().toISOString().split("T")[0],
      preferredPickupTime: preferredPickupTime || "",
      specialRequirements: specialRequirements || null,
      status: ShipmentStatus.PENDING,
      amount: 0, // Price updated by admin later
      serviceId: service.id,
      origin,
      destination,
      arrivalDate,
      userId: user?.id || undefined,
    });

    await repo().save(shipment);

    // Initial Tracking Checkpoint
    const tracking = trackingRepo().create({
      shipmentId: shipment.id,
      checkpoint: "Pickup Confirmed",
      location: origin,
      status: ShipmentStatus.PENDING,
      date: new Date(),
    });
    await trackingRepo().save(tracking);

    // Notification email
    const estimatedArrivalDate = arrivalDate || "To be confirmed";
    sendBookingConfirmationEmail(shipment.email, {
      fullName: shipment.fullName,
      shippingId: shipment.shippingId,
      trackingId: shipment.trackingId,
      serviceName: service.serviceName,
      origin: shipment.origin || shipment.pickupCity,
      destination: shipment.destination || shipment.destinationCity,
      arrivalDate: estimatedArrivalDate,
      amount: shipment.amount,
    }).catch(console.error);

    return res.status(201).json({
      status: "success",
      message: "Shipment booked successfully.",
      data: {
        ...shipment,
        trackingId: shipment.trackingId,
      },
      trackingId: shipment.trackingId, // Explicitly return this for the frontend
    });
  } catch (err) {
    console.error("[ShipmentController.createShipment]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Customer: My shipments ───────────────────────────────────────────────────

export async function myShipments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as ShipmentStatus | undefined;
    const search = (req.query.search as string) || "";

    const qb = repo()
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.service", "service")
      .leftJoinAndSelect("s.payments", "payments")
      .where("s.userId = :uid", { uid: user.id });

    if (status && Object.values(ShipmentStatus).includes(status)) {
      qb.andWhere("s.status = :status", { status });
    }
    if (search) {
      qb.andWhere(
        "(s.trackingId ILIKE :s OR s.shippingId ILIKE :s OR s.pickupCity ILIKE :s OR s.destinationCity ILIKE :s)",
        { s: `%${search}%` },
      );
    }

    qb.orderBy("s.createdAt", "DESC").skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[ShipmentController.myShipments]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Public: Track by tracking ID ────────────────────────────────────────────

export async function trackShipment(req: Request, res: Response) {
  try {
    const { trackingId } = req.params;
    const shipment = await repo().findOne({
      where: { trackingId },
      relations: ["trackingUpdates", "service", "payments"],
    });

    if (!shipment) {
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });
    }

    // Sort tracking updates chronologically
    if (shipment.trackingUpdates) {
      shipment.trackingUpdates.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    }

    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    console.error("[ShipmentController.trackShipment]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Customer/Admin: Get single shipment ─────────────────────────────────────

export async function getShipment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user as User;

    const shipment = await repo().findOne({
      where: { id },
      relations: ["user", "service", "trackingUpdates", "payments"],
    });

    if (!shipment) {
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });
    }

    // Customers can only view their own shipments
    if (user.role === "CUSTOMER" && shipment.userId !== user.id) {
      return res.status(403).json({ status: "error", message: "Forbidden." });
    }

    return res.status(200).json({ status: "success", data: shipment });
  } catch (err) {
    console.error("[ShipmentController.getShipment]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Assign Price after Inspection ────────────────────────────────────

export async function assignShipmentPrice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined || amount < 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Valid amount is required." });
    }

    const shipment = await repo().findOne({
      where: { id },
      relations: ["user"],
    });
    if (!shipment)
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });

    shipment.amount = Number(amount);
    shipment.status = ShipmentStatus.PROCESSING; // Move to processing after inspection/pricing
    await repo().save(shipment);

    // Notify user about the price
    sendPriceQuoteEmail(shipment.email, {
      fullName: shipment.fullName,
      trackingId: shipment.trackingId,
      amount: shipment.amount,
    }).catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "Price assigned and user notified.",
      data: shipment,
    });
  } catch (err) {
    console.error("[ShipmentController.assignShipmentPrice]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: List all shipments ────────────────────────────────────────────────

export async function listShipments(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as ShipmentStatus | undefined;
    const search = (req.query.search as string) || "";
    const city = (req.query.city as string) || "";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const qb = repo()
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.user", "u")
      .leftJoinAndSelect("s.payments", "p");

    if (status && Object.values(ShipmentStatus).includes(status)) {
      qb.andWhere("s.status = :status", { status });
    }
    if (search) {
      qb.andWhere(
        `(s.trackingId ILIKE :s OR s.shippingId ILIKE :s OR s.fullName ILIKE :s
          OR s.email ILIKE :s OR s.pickupCity ILIKE :s OR s.destinationCity ILIKE :s)`,
        { s: `%${search}%` },
      );
    }
    if (city) {
      qb.andWhere(
        "(s.pickupCity ILIKE :city OR s.destinationCity ILIKE :city)",
        { city: `%${city}%` },
      );
    }
    if (from) qb.andWhere("s.createdAt >= :from", { from });
    if (to) qb.andWhere("s.createdAt <= :to", { to });

    qb.orderBy("s.createdAt", "DESC").skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[ShipmentController.listShipments]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Update shipment status ───────────────────────────────────────────

export async function updateShipmentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, packageDetails, weight } = req.body;

    if (!status || !Object.values(ShipmentStatus).includes(status)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid status. Must be one of: ${Object.values(ShipmentStatus).join(", ")}`,
      });
    }

    const shipment = await repo().findOne({
      where: { id },
      relations: ["user"],
    });
    if (!shipment) {
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });
    }

    shipment.status = status;
    if (packageDetails !== undefined) shipment.packageDetails = packageDetails;
    if (weight !== undefined) shipment.weight = Number(weight);

    await repo().save(shipment);

    // Notify customer
    sendStatusUpdateEmail(shipment.email, {
      fullName: shipment.fullName,
      trackingId: shipment.trackingId,
      status: shipment.status,
      pickupCity: shipment.pickupCity,
      destinationCity: shipment.destinationCity,
    }).catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "Shipment status updated.",
      data: shipment,
    });
  } catch (err) {
    console.error("[ShipmentController.updateShipmentStatus]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Add Tracking Checkpoint ──────────────────────────────────────────

export async function addTrackingCheckpoint(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { checkpoint, location, status } = req.body;

    if (
      !checkpoint ||
      !status ||
      !Object.values(ShipmentStatus).includes(status)
    ) {
      return res.status(400).json({
        status: "error",
        message: `Missing checkpoint or invalid status. Expected one of: ${Object.values(ShipmentStatus).join(", ")}`,
      });
    }

    const shipment = await repo().findOne({
      where: { id },
      relations: ["user"],
    });

    if (!shipment) {
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });
    }

    // Creating the checkpoint
    const tracking = trackingRepo().create({
      shipmentId: shipment.id,
      checkpoint,
      location,
      status,
      date: new Date(),
    });

    await trackingRepo().save(tracking);

    // Update parent shipment status to reflect the new checkpoint
    shipment.status = status;
    await repo().save(shipment);

    // Send notifications to User & Admin if it's Arrival or Delivery
    if (
      status === ShipmentStatus.ARRIVED ||
      status === ShipmentStatus.DELIVERED
    ) {
      sendStatusUpdateEmail(shipment.email, {
        fullName: shipment.fullName,
        trackingId: shipment.trackingId,
        status: shipment.status,
        pickupCity: shipment.pickupCity,
        destinationCity: shipment.destinationCity,
      }).catch(console.error);

      // We can also send Admin notification here. For brevity, simulating SMS notification:
      console.log(
        `[SMS Simulation] To: ${shipment.phoneNumber} - Your shipment ${shipment.trackingId} has arrived at the destination terminal. Thank you for using EagleNet Logistics.`,
      );
    }

    return res.status(201).json({
      status: "success",
      message: "Tracking checkpoint added and shipment status updated.",
      data: tracking,
    });
  } catch (err) {
    console.error("[ShipmentController.addTrackingCheckpoint]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Shipment, ShipmentStatus } from "../entities/Shipment";
import { User } from "../entities/User";
import { generateEglId, paginate, parsePagination } from "../utils/helpers";
import {
  sendBookingConfirmationEmail,
  sendStatusUpdateEmail,
} from "../services/email.service";

const repo = () => AppDataSource.getRepository(Shipment);

// ─── Customer: Create a booking ───────────────────────────────────────────────

export async function createShipment(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const {
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
      amount,
    } = req.body;

    const required = [
      "fullName",
      "email",
      "phoneNumber",
      "pickupAddress",
      "pickupCity",
      "deliveryAddress",
      "destinationCity",
      "preferredPickupDate",
      "preferredPickupTime",
    ];

    const missing = required.filter((k) => !req.body[k]);
    if (missing.length) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const shipment = repo().create({
      shippingId: generateEglId("SHIP"),
      trackingId: generateEglId("TRK"),
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      pickupAddress: pickupAddress.trim(),
      pickupCity: pickupCity.trim(),
      deliveryAddress: deliveryAddress.trim(),
      destinationCity: destinationCity.trim(),
      preferredPickupDate,
      preferredPickupTime,
      specialRequirements: specialRequirements || null,
      status: ShipmentStatus.PENDING,
      amount: amount ? Number(amount) : 0,
      userId: user?.id || undefined,
    });

    await repo().save(shipment);

    // Notification email
    sendBookingConfirmationEmail(shipment.email, {
      fullName: shipment.fullName,
      shippingId: shipment.shippingId,
      trackingId: shipment.trackingId,
      pickupCity: shipment.pickupCity,
      destinationCity: shipment.destinationCity,
      preferredPickupDate: shipment.preferredPickupDate,
      amount: shipment.amount,
    }).catch(console.error);

    return res.status(201).json({
      status: "success",
      message: "Shipment booked successfully.",
      data: shipment,
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
    const shipment = await repo().findOne({ where: { trackingId } });

    if (!shipment) {
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });
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
      relations: ["user"],
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

// ─── Admin: List all shipments ────────────────────────────────────────────────

export async function listShipments(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as ShipmentStatus | undefined;
    const search = (req.query.search as string) || "";
    const city = (req.query.city as string) || "";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const qb = repo().createQueryBuilder("s").leftJoinAndSelect("s.user", "u");

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

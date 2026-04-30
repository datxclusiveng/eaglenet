import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment } from "../entities/Shipment";
import { lookupExternalTracking } from "../services/tracktrace.service";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { User } from "../../users/entities/User";

const repo = () => AppDataSource.getRepository(Shipment);

// ─── GET /api/shipments/:id/track-external ─────────────────────────────────────
/**
 * Look up a shipment's external carrier tracking via AfterShip.
 * Uses the shipment's flightOrVoyageNumber as the tracking number
 * and airlineOrVessel to hint the carrier.
 */
export async function getShipmentExternalTracking(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const user = (req as any).user as User;

    const shipment = await repo().findOneBy({ id });
    if (!shipment) {
      return res.status(404).json({ status: "error", message: "Shipment not found." });
    }

    if (!shipment.flightOrVoyageNumber) {
      return res.status(400).json({
        status: "error",
        message: "This shipment has no flight/voyage number set. Cannot look up external tracking.",
      });
    }

    const result = await lookupExternalTracking(
      shipment.flightOrVoyageNumber,
      shipment.airlineOrVessel || undefined
    );

    // Audit trail (fire-and-forget)
    createAuditLog({
      entityType: "Shipment",
      entityId: shipment.id,
      action: AuditAction.VIEW,
      actionDetails: {
        event: "external_tracking_lookup",
        trackingNumber: shipment.flightOrVoyageNumber,
        carrierSlug: result.carrierSlug,
        source: "aftership",
      },
      performedBy: user.id,
      departmentId: shipment.departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success({
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        shipmentName: shipment.shipmentName,
        internalStatus: shipment.status,
      },
      externalTracking: result,
    }, "External tracking retrieved successfully.");
  } catch (err: any) {
    console.error("[TrackTrace.getShipmentTracking]", err.message);

    if (err.message?.includes("AfterShip error")) {
      return res.status(502).json({ status: "error", message: err.message });
    }
    if (err.message?.includes("not found")) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    if (err.message?.includes("not configured")) {
      return res.status(503).json({
        status: "error",
        message: "External tracking service is not configured. Contact an administrator.",
      });
    }

    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/shipments/track-external?trackingNumber=&carrier= ───────────────
/**
 * Free-form external tracking lookup.
 * Staff can search any tracking number across any carrier.
 * Query params:
 *   trackingNumber (required) — external carrier tracking number
 *   carrier       (optional) — carrier name hint e.g. "DHL", "FedEx", "MSC"
 */
export async function lookupExternalTrackingFreeform(req: Request, res: Response) {
  try {
    const { trackingNumber, carrier } = req.query as {
      trackingNumber?: string;
      carrier?: string;
    };

    if (!trackingNumber || !trackingNumber.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Query param 'trackingNumber' is required.",
      });
    }

    const result = await lookupExternalTracking(trackingNumber.trim(), carrier?.trim());

    return (res as any).success(result, "External tracking retrieved successfully.");
  } catch (err: any) {
    console.error("[TrackTrace.freeformLookup]", err.message);

    if (err.message?.includes("AfterShip error")) {
      return res.status(502).json({ status: "error", message: err.message });
    }
    if (err.message?.includes("not found")) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    if (err.message?.includes("not configured")) {
      return res.status(503).json({
        status: "error",
        message: "External tracking service is not configured. Contact an administrator.",
      });
    }

    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

import { AppDataSource } from "../../../../database/data-source";
import { Shipment } from "../../shipments/entities/Shipment";
import { Tracking } from "../../shipments/entities/Tracking";
import { CustomsClearance } from "../../shipments/entities/CustomsClearance";
import { ShipmentLog, LogVisibility } from "../../shipments/entities/ShipmentLog";

const shipmentRepo = () => AppDataSource.getRepository(Shipment);

// ─── Public DTO Types ────────────────────────────────────────────────────────────

export interface PublicShipmentDetail {
  trackingNumber: string;
  shipmentName: string;
  type: string;
  status: string;
  origin: { city: string; country: string } | null;
  destination: { city: string; country: string } | null;
  weightKg: number | null;
  volumeCbm: number | null;
  description: string | null;
  clientName: string | null;
  trackingUpdates: {
    checkpoint: string;
    location: string | null;
    status: string;
    date: Date;
  }[];
  customsStatus: string | null;
  publicLogs: {
    status: string | null;
    date: Date;
    note: string | null;
  }[];
}

export interface PublicShipmentSummary {
  trackingNumber: string;
  shipmentName: string;
  status: string;
  type: string;
  origin: { city: string; country: string } | null;
  destination: { city: string; country: string } | null;
}

// ─── Mapping Helpers ─────────────────────────────────────────────────────────────

function toPublicShipmentDetail(shipment: Shipment): PublicShipmentDetail {
  const originCity = shipment.originCity || "";
  const originCountry = shipment.originCountry || "";
  const destCity = shipment.destinationCity || "";
  const destCountry = shipment.destinationCountry || "";

  return {
    trackingNumber: shipment.trackingNumber,
    shipmentName: shipment.shipmentName,
    type: shipment.type,
    status: shipment.status,
    origin:
      originCity || originCountry
        ? { city: originCity, country: originCountry }
        : null,
    destination:
      destCity || destCountry
        ? { city: destCity, country: destCountry }
        : null,
    weightKg: shipment.weightKg ?? null,
    volumeCbm: shipment.volumeCbm ?? null,
    description: shipment.description ?? null,
    clientName: shipment.clientName ?? null,
    trackingUpdates: (shipment.trackingUpdates || []).map((t: Tracking) => ({
      checkpoint: t.checkpoint,
      location: t.location ?? null,
      status: t.status,
      date: t.date,
    })),
    customsStatus: (shipment as any).customsClearance?.status ?? null,
    publicLogs: (shipment.logs || [])
      .filter(
        (l: ShipmentLog) =>
          l.action === "status_change" && l.visibility === LogVisibility.PUBLIC
      )
      .map((l: ShipmentLog) => ({
        status: l.newStatus ?? null,
        date: l.createdAt,
        note: l.note ?? null,
      })),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * Look up a single shipment by its tracking number.
 * Returns a public-safe subset of fields only.
 */
export async function trackByTrackingNumber(
  trackingNumber: string
): Promise<PublicShipmentDetail | null> {
  const shipment = await shipmentRepo().findOne({
    where: { trackingNumber },
    relations: ["trackingUpdates", "logs"],
  });

  if (!shipment) return null;

  // Fetch customs clearance separately (1:1 relation not eager-loaded)
  const customs = await AppDataSource.getRepository(CustomsClearance).findOne({
    where: { shipmentId: shipment.id },
  });
  (shipment as any).customsClearance = customs;

  return toPublicShipmentDetail(shipment);
}

/**
 * Search for shipments associated with a customer email.
 * Returns summary info only — no tracking detail, no logs.
 */
export async function trackByEmail(
  email: string
): Promise<PublicShipmentSummary[]> {
  const shipments = await shipmentRepo().find({
    where: { clientEmail: email, isDeleted: false },
    order: { createdAt: "DESC" },
    take: 50,
  });

  return shipments.map((s) => ({
    trackingNumber: s.trackingNumber,
    shipmentName: s.shipmentName,
    status: s.status,
    type: s.type,
    origin:
      s.originCity || s.originCountry
        ? { city: s.originCity || "", country: s.originCountry || "" }
        : null,
    destination:
      s.destinationCity || s.destinationCountry
        ? { city: s.destinationCity || "", country: s.destinationCountry || "" }
        : null,
  }));
}

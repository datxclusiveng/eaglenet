import axios from "axios";
import { appCache } from "../../../utils/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExternalTrackingEvent {
  status: string;
  location: string;
  timestamp: string;
  description: string;
  rawTag?: string;
}

export interface ExternalTrackingResult {
  carrier: string;
  carrierSlug: string;
  trackingNumber: string;
  currentStatus: string;
  currentLocation?: string;
  destinationCountry?: string;
  events: ExternalTrackingEvent[];
  estimatedDelivery?: string;
  source: "aftership";
}

// ─── Carrier Slug Lookup Map ──────────────────────────────────────────────────
// Maps common airline/vessel names to AfterShip carrier slugs.
// AfterShip auto-detects if no slug is provided.
const CARRIER_SLUG_MAP: Record<string, string> = {
  dhl: "dhl",
  "dhl express": "dhl",
  fedex: "fedex",
  "federal express": "fedex",
  ups: "ups",
  "united parcel service": "ups",
  msc: "msc",
  "mediterranean shipping": "msc",
  "hapag-lloyd": "hapag-lloyd",
  hapag: "hapag-lloyd",
  cosco: "cosco",
  "maersk line": "maersk",
  maersk: "maersk",
  cma: "cma-cgm",
  "cma cgm": "cma-cgm",
  "cma-cgm": "cma-cgm",
  ems: "ems",
  "kenya airways": "kenya-airways-cargo",
  "ethiopian airlines": "ethiopian-airlines-cargo",
  "emirates skycargo": "emirates-skycargo",
  emirates: "emirates-skycargo",
  "qatar airways": "qatar-airways-cargo",
  "turkish airlines": "turkish-airlines-cargo",
  aramex: "aramex",
  "dhl global forwarding": "dhl-global-forwarding",
  evergreen: "evergreen",
  yang: "yang-ming",
  "yang ming": "yang-ming",
  one: "one-ocean-network-express",
  "ocean network express": "one-ocean-network-express",
};

// ─── AfterShip Status → EagleNet Status Mapping ───────────────────────────────
const STATUS_MAP: Record<string, string> = {
  Pending: "pending",
  InfoReceived: "pending",
  InTransit: "in_transit",
  OutForDelivery: "in_transit",
  AttemptFail: "on_hold",
  Delivered: "delivered",
  AvailableForPickup: "in_transit",
  Exception: "on_hold",
  Expired: "on_hold",
  Failed: "on_hold",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCarrierSlug(airlineOrVessel?: string): string | undefined {
  if (!airlineOrVessel) return undefined;
  const key = airlineOrVessel.toLowerCase().trim();
  return CARRIER_SLUG_MAP[key];
}

function getAfterShipClient() {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  const baseURL = process.env.AFTERSHIP_BASE_URL || "https://api.aftership.com/v4";

  if (!apiKey) {
    throw new Error("AFTERSHIP_API_KEY is not configured.");
  }

  return axios.create({
    baseURL,
    headers: {
      "as-api-key": apiKey,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });
}

function normalizeEvents(checkpoints: any[]): ExternalTrackingEvent[] {
  if (!Array.isArray(checkpoints)) return [];
  return checkpoints.map((cp) => ({
    status: STATUS_MAP[cp.tag] || cp.tag || "unknown",
    location: [cp.city, cp.state, cp.country_name].filter(Boolean).join(", "),
    timestamp: cp.checkpoint_time || cp.created_at,
    description: cp.message || cp.subtag_message || "",
    rawTag: cp.tag,
  }));
}

// ─── Core Lookup Function ─────────────────────────────────────────────────────

/**
 * Look up a shipment on AfterShip by tracking number.
 * If a carrier slug is provided it calls the direct endpoint;
 * otherwise it creates a new tracking on AfterShip (auto-detect) and polls.
 *
 * Results are cached for 5 minutes per tracking number.
 */
export async function lookupExternalTracking(
  trackingNumber: string,
  airlineOrVessel?: string
): Promise<ExternalTrackingResult> {
  const cacheKey = `aftership_${trackingNumber}`;
  const cached = appCache.get<ExternalTrackingResult>(cacheKey);
  if (cached) return cached;

  const client = getAfterShipClient();
  const carrierSlug = getCarrierSlug(airlineOrVessel);

  let trackingData: any;

  try {
    if (carrierSlug) {
      // Direct fetch if carrier is known
      const response = await client.get(`/trackings/${carrierSlug}/${trackingNumber}`);
      trackingData = response.data?.data?.tracking;
    } else {
      // Try to create a tracking first (AfterShip auto-detects carrier)
      try {
        const createRes = await client.post("/trackings", {
          tracking: { tracking_number: trackingNumber },
        });
        trackingData = createRes.data?.data?.tracking;
      } catch (createErr: any) {
        // 4013 = tracking already exists — just fetch it
        if (createErr?.response?.data?.meta?.code === 4013) {
          // We don't know the slug, so use the slug-less fetch endpoint
          const detectRes = await client.get(`/trackings?tracking_numbers=${trackingNumber}`);
          const rows = detectRes.data?.data?.trackings || [];
          trackingData = rows[0] || null;
        } else {
          throw createErr;
        }
      }
    }
  } catch (err: any) {
    const afterShipError = err?.response?.data?.meta;
    if (afterShipError) {
      throw new Error(`AfterShip error ${afterShipError.code}: ${afterShipError.message}`);
    }
    throw err;
  }

  if (!trackingData) {
    throw new Error("Tracking not found on AfterShip.");
  }

  const result: ExternalTrackingResult = {
    carrier: trackingData.courier_tracking_link
      ? (trackingData.courier_tracking_link.split("/")[2] || trackingData.slug)
      : (trackingData.slug || airlineOrVessel || "unknown"),
    carrierSlug: trackingData.slug || carrierSlug || "unknown",
    trackingNumber: trackingData.tracking_number || trackingNumber,
    currentStatus: STATUS_MAP[trackingData.tag] || trackingData.tag || "unknown",
    currentLocation: [
      trackingData.tracked_count ? trackingData.destination_country_iso3 : null,
    ].filter(Boolean).join(""),
    destinationCountry: trackingData.destination_country_iso3,
    events: normalizeEvents(trackingData.checkpoints || []),
    estimatedDelivery: trackingData.expected_delivery || undefined,
    source: "aftership",
  };

  // Cache for 5 minutes
  appCache.set(cacheKey, result, 300);

  return result;
}

/**
 * Invalidate the cache for a specific tracking number.
 * Called when a shipment's flightOrVoyageNumber is updated.
 */
export function invalidateTrackingCache(trackingNumber: string): void {
  appCache.del(`aftership_${trackingNumber}`);
}

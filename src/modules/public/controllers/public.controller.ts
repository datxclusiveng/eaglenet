import { Request, Response } from "express";
import { trackByTrackingNumber, trackByEmail } from "../services/public.service";

/**
 * POST /api/track
 * Public — no authentication required.
 *
 * Query params:
 *   trackingNumber — returns full public detail for a single shipment
 *   email          — returns a summary list of shipments for that customer
 */
export async function trackPublic(req: Request, res: Response) {
  try {
    const { trackingNumber, email } = req.query as {
      trackingNumber?: string;
      email?: string;
    };

    if (trackingNumber) {
      const detail = await trackByTrackingNumber(trackingNumber.trim());
      if (!detail) {
        return res
          .status(404)
          .json({ status: "error", message: "Shipment not found." });
      }
      return res.status(200).json({ status: "success", data: detail });
    }

    if (email) {
      const results = await trackByEmail(email.trim().toLowerCase());
      return res.status(200).json({
        status: "success",
        data: results,
        meta: { count: results.length },
      });
    }

    // Should not reach here — validation middleware catches this
    return res
      .status(400)
      .json({ status: "error", message: "Provide trackingNumber or email." });
  } catch (err) {
    console.error("[PublicController.trackPublic]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

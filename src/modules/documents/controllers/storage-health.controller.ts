import { Request, Response } from "express";
import { checkB2Connection } from "../../../utils/storage.service";

/**
 * GET /api/documents/storage/health
 *
 * Admin-only endpoint that probes Backblaze B2 (or local storage) and
 * returns a detailed connectivity report — no secrets are exposed.
 *
 * Response shape:
 * {
 *   status: "success" | "error",
 *   data: {
 *     connected: boolean,
 *     message: string,
 *     mode: "backblaze" | "local",
 *     config: { endpoint, bucket, region, publicUrl },
 *     checkedAt: ISO string,
 *     error?: string       // only when connected === false
 *   }
 * }
 */
export async function storageHealthCheck(_req: Request, res: Response) {
  try {
    const result = await checkB2Connection();

    // Return 200 even on connection failure so the client can read the body.
    // The `connected` flag is the authoritative indicator.
    return res.status(200).json({
      status: result.connected ? "success" : "error",
      data: result,
    });
  } catch (err) {
    console.error("[StorageHealthController]", err);
    return res.status(500).json({
      status: "error",
      message: "Storage health check encountered an unexpected error.",
    });
  }
}

import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { performGlobalSearch } from "../services/search.service";

/**
 * GET /api/search
 * Query params:
 * - q: search string (min 2 chars)
 * - type: optional "shipment" | "document" | "user" | "invoice"
 */
export async function globalSearchHandler(req: Request, res: Response) {
  try {
    const query = req.query.q as string;
    const type = req.query.type as any;
    const actor = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ status: "error", message: "Query too short. Minimum 2 characters." });
    }

    const results = await performGlobalSearch({
        query: query.trim(),
        type,
        actor,
        scope,
        departmentId
    });

    return res.status(200).json({ status: "success", data: results });
  } catch (err) {
    console.error("[SearchController.globalSearch]", err);
    return res.status(500).json({ status: "error", message: "Failed to perform search." });
  }
}

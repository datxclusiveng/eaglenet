import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { bulkImportShipments } from "../services/bulk-import.service";

/**
 * Phase 5 — Bulk Import Controller
 * POST /api/shipments/bulk-import
 *
 * Accepts a multipart/form-data upload containing an Excel (.xlsx/.xls) or CSV file.
 * The file is parsed row-by-row to create historical/external shipment records.
 *
 * Body (form-data):
 *   file            - The spreadsheet file (required)
 *   departmentId    - UUID of the owning department (optional)
 *   commitMessage   - Reason for this bulk import (required for audit trail)
 *   defaultServiceId - Fallback service if not specified per-row (optional)
 *
 * Returns a detailed import report: total, inserted, skipped, errors[]
 */
export async function bulkImportShipmentsController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No file uploaded. Please attach an Excel (.xlsx/.xls) or CSV file.",
      });
    }

    const { departmentId, commitMessage, defaultServiceId } = req.body;

    if (!commitMessage || String(commitMessage).trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "A commit message is required for bulk imports. Describe what records are being imported.",
      });
    }

    const result = await bulkImportShipments(
      req.file.buffer,
      user.id,
      departmentId,
      commitMessage,
      defaultServiceId
    );

    const statusCode = result.errors.length > 0 && result.inserted === 0 ? 422 : 200;
    const status = statusCode === 422 ? "error" : "success";
    const message =
      result.errors.length === 0
        ? `Bulk import complete. ${result.inserted} records created.`
        : `Import partially complete. ${result.inserted} inserted, ${result.skipped} skipped.`;

    return res.status(statusCode).json({
      status,
      message,
      data: result,
    });
  } catch (err) {
    console.error("[BulkImportController]", err);
    return res.status(500).json({ status: "error", message: "Bulk import failed. Please check the file format." });
  }
}

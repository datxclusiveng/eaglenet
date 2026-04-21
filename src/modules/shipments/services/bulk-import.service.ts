import * as XLSX from "xlsx";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus, ShipmentType } from "../entities/Shipment";
import { MoreThanOrEqual } from "typeorm";

const shipmentRepo = () => AppDataSource.getRepository(Shipment);

// ────────────────────────────────────────────────────────────────────────────
// Expected column headers in the uploaded spreadsheet (case-insensitive match)
// ────────────────────────────────────────────────────────────────────────────
const REQUIRED_COLS = ["fullName", "email", "phoneNumber", "origin", "destination"];

export interface BulkImportResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

import { generateTrackingNumber } from "../utils/generators";

/**
 * Parses an Excel or CSV buffer and inserts shipment records in bulk.
 */
export async function bulkImportShipments(
  buffer: Buffer,
  staffId: string,
  departmentId?: string,
  commitMessage?: string
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  // ── 1. Parse the workbook ────────────────────────────────────────────────
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0]; 
  const worksheet = workbook.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  result.total = rows.length;

  // ── 2. Get today's count for tracking numbers ──────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let dailyCount = await shipmentRepo().count({ 
    where: { createdAt: MoreThanOrEqual(today) } 
  });

  // ── 3. Process each row ──────────────────────────────────────────────────
  const toInsert: Shipment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      norm[k.trim()] = String(v ?? "").trim();
    }

    // ── Validation ─────────────────────────────────────────────────────────
    const missing = REQUIRED_COLS.filter((col) => !norm[col]);
    if (missing.length > 0) {
      result.errors.push({ row: rowNumber, reason: `Missing required fields: ${missing.join(", ")}` });
      result.skipped++;
      continue;
    }

    const type = (norm["type"]?.toLowerCase() === "export") ? ShipmentType.EXPORT : ShipmentType.IMPORT;

    // ── Build Shipment Record ──────────────────────────────────────────────
    const shipment = shipmentRepo().create({
      trackingNumber: generateTrackingNumber(type, dailyCount + 1),
      shipmentName: norm["shipmentName"] || norm["fullName"] || "Bulk Import Shipment",
      type,
      clientName: norm["fullName"] || "Unknown",
      clientEmail: norm["email"].toLowerCase(),
      clientPhone: norm["phoneNumber"],
      originCity: norm["origin"],
      destinationCity: norm["destination"],
      status: (norm["status"] as ShipmentStatus) || ShipmentStatus.PENDING,
      assignedOfficerId: staffId,
      departmentId: departmentId,
      createdById: staffId,
      internalNotes: commitMessage || "Bulk imported by admin",
      notes: norm["notes"] || "",
    });

    toInsert.push(shipment);
    dailyCount++;
  }


  // ── 4. Batch insert (chunks of 100 to avoid DB limits) ──────────────────
  const CHUNK_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    await shipmentRepo().save(chunk);
    result.inserted += chunk.length;
  }

  return result;
}

import * as XLSX from "xlsx";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus, CreationSource } from "../entities/Shipment";
import { Service } from "../entities/Service";
import { generateEglId } from "../../../utils/helpers";

const shipmentRepo = () => AppDataSource.getRepository(Shipment);
const serviceRepo = () => AppDataSource.getRepository(Service);

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

/**
 * Parses an Excel or CSV buffer and inserts shipment records in bulk.
 *
 * @param buffer       Raw file buffer from multer memory storage
 * @param staffId      ID of the staff member performing the import
 * @param departmentId Owning department (optional)
 * @param commitMessage  Explains why this batch was imported
 * @param defaultServiceId  Fallback service UUID if not specified in a row
 */
export async function bulkImportShipments(
  buffer: Buffer,
  staffId: string,
  departmentId?: string,
  commitMessage?: string,
  defaultServiceId?: string
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  // ── 1. Parse the workbook ────────────────────────────────────────────────
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const worksheet = workbook.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",  // empty cells become empty string
    raw: false,  // return formatted values, not raw numbers
  });

  result.total = rows.length;

  // ── 2. Resolve default service ───────────────────────────────────────────
  let defaultService: Service | null = null;
  if (defaultServiceId) {
    defaultService = await serviceRepo().findOneBy({ id: defaultServiceId });
  }

  // ── 3. Process each row ──────────────────────────────────────────────────
  const toInsert: Shipment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // 1-indexed, accounting for header row

    // Normalise keys: trim whitespace and lowercase for matching
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      norm[k.trim()] = String(v ?? "").trim();
    }

    // ── Validation ─────────────────────────────────────────────────────────
    type MissingArray = string[];
    const missing: MissingArray = REQUIRED_COLS.filter((col) => !norm[col]);
    if (missing.length > 0) {
      result.errors.push({ row: rowNumber, reason: `Missing required fields: ${missing.join(", ")}` });
      result.skipped++;
      continue;
    }

    // Resolve service: row-level takes precedence over default
    let service = defaultService;
    if (norm["serviceId"]) {
      service = await serviceRepo().findOneBy({ id: norm["serviceId"] });
      if (!service) {
        result.errors.push({ row: rowNumber, reason: `Service ID "${norm["serviceId"]}" not found` });
        result.skipped++;
        continue;
      }
    }

    // ── Build Shipment Record ──────────────────────────────────────────────
    const shipment = shipmentRepo().create({
      shippingId: generateEglId("SHIP"),
      trackingId: `EGLN${Math.floor(10000000 + Math.random() * 90000000)}`,
      fullName: norm["fullName"],
      email: norm["email"].toLowerCase(),
      phoneNumber: norm["phoneNumber"],
      pickupAddress: norm["pickupAddress"] || norm["origin"],
      pickupCity: norm["pickupCity"] || norm["origin"],
      deliveryAddress: norm["deliveryAddress"] || norm["destination"],
      destinationCity: norm["destinationCity"] || norm["destination"],
      preferredPickupDate: norm["preferredPickupDate"] || new Date().toISOString().split("T")[0],
      preferredPickupTime: norm["preferredPickupTime"] || "00:00",
      origin: norm["origin"],
      destination: norm["destination"],
      specialRequirements: norm["specialRequirements"] || undefined,
      packageDetails: norm["packageDetails"] || undefined,
      status: (norm["status"] as ShipmentStatus) || ShipmentStatus.DELIVERED,
      amount: parseFloat(norm["amount"]) || 0,
      serviceId: service?.id,
      userId: undefined,                   // No registered user — external record
      departmentId: departmentId,
      creationSource: CreationSource.STAFF,
      isExternal: true,
      dynamicFields: {
        commitMessage: commitMessage || "Bulk import",
        importedBy: staffId,
        rawRow: norm,                       // Keep original row for auditing
      },
    });

    toInsert.push(shipment);
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

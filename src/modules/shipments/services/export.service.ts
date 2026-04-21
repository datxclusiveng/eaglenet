import * as XLSX from "xlsx";
import { Shipment } from "../entities/Shipment";

/**
 * Generates an Excel (XLSX) buffer from an array of shipments.
 */
export function exportShipmentsToExcel(shipments: Shipment[]): Buffer {
  const data = shipments.map((s) => ({
    "Tracking Number": s.trackingNumber,
    "Shipment Name": s.shipmentName || "N/A",
    "Type": s.type,
    "Status": s.status,
    "Client Name": s.clientName || "N/A",
    "Client Email": s.clientEmail || "N/A",
    "Origin": `${s.originCity || ""}, ${s.originCountry || ""}`,
    "Destination": `${s.destinationCity || ""}, ${s.destinationCountry || ""}`,
    "Creation Date": s.createdAt,
    "ETA": s.eta || "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shipments");

  // Generate buffer
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/**
 * Generates a CSV string from an array of shipments.
 */
export function exportShipmentsToCSV(shipments: Shipment[]): string {
  const data = shipments.map((s) => ({
    trackingNumber: s.trackingNumber,
    name: s.shipmentName,
    type: s.type,
    status: s.status,
    client: s.clientName,
    origin: s.originCity,
    destination: s.destinationCity,
    createdAt: s.createdAt.toISOString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  return XLSX.utils.sheet_to_csv(worksheet);
}

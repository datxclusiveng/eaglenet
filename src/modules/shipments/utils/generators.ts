import { ShipmentType } from "../entities/Shipment";

/**
 * Generates a tracking number in the format: EGL-DEPT-YYYYMMDD-XXX
 * @param type ShipmentType (AIR_FREIGHT or SEA_FREIGHT)
 * @param index Sequential index for the day
 */
export const generateTrackingNumber = (type: ShipmentType, index: number): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const deptCode = type === ShipmentType.AIR_FREIGHT ? "AF" : "SF";
  const sequentialId = String(index).padStart(3, "0");
  
  return `EGL-${deptCode}-${dateStr}-${sequentialId}`;
};

/**
 * Generates an invoice number in the format: INV-YYYYMMDD-XXX
 * @param index Sequential index for the day
 */
export const generateInvoiceNumber = (index: number): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const sequentialId = String(index).padStart(3, "0");
  
  return `INV-${dateStr}-${sequentialId}`;
};

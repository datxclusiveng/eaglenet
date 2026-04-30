import { Request, Response } from "express";
import {
  getShipmentReport,
  getPerformanceReport,
  getCustomerReport,
  getFinancialReport,
} from "../services/report.service";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";

// ─── GET /api/reports/shipments ───────────────────────────────────────────────
/**
 * Shipment Summary Report
 * Query params: startDate, endDate, departmentId, type (export|import)
 */
export async function shipmentReport(req: Request, res: Response) {
  try {
    const user = (req as any).user as any;
    const { startDate, endDate, departmentId, type } = req.query as Record<string, string>;

    if (type && !["export", "import"].includes(type)) {
      return res.status(400).json({ status: "error", message: "Invalid type. Must be 'export' or 'import'." });
    }

    const data = await getShipmentReport({ startDate, endDate, departmentId, type });

    createAuditLog({
      entityType: "Report",
      action: AuditAction.READ,
      actionDetails: { report: "shipment_summary", filters: { startDate, endDate, departmentId, type } },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(data, "Shipment summary report generated.", {
      report: "shipment_summary",
      filters: { startDate, endDate, departmentId, type },
    });
  } catch (err) {
    console.error("[ReportController.shipmentReport]", err);
    return res.status(500).json({ status: "error", message: "Failed to generate shipment report." });
  }
}

// ─── GET /api/reports/performance ────────────────────────────────────────────
/**
 * Performance Report — on-time delivery rates, status funnel, per-department breakdown
 * Query params: startDate, endDate, departmentId
 */
export async function performanceReport(req: Request, res: Response) {
  try {
    const user = (req as any).user as any;
    const { startDate, endDate, departmentId } = req.query as Record<string, string>;

    const data = await getPerformanceReport({ startDate, endDate, departmentId });

    createAuditLog({
      entityType: "Report",
      action: AuditAction.READ,
      actionDetails: { report: "performance", filters: { startDate, endDate, departmentId } },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(data, "Performance report generated.", {
      report: "performance",
      filters: { startDate, endDate, departmentId },
    });
  } catch (err) {
    console.error("[ReportController.performanceReport]", err);
    return res.status(500).json({ status: "error", message: "Failed to generate performance report." });
  }
}

// ─── GET /api/reports/customers ───────────────────────────────────────────────
/**
 * Customer Report — top customers by shipment volume
 * Query params: limit (default 10)
 */
export async function customerReport(req: Request, res: Response) {
  try {
    const user = (req as any).user as any;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ status: "error", message: "limit must be a number between 1 and 100." });
    }

    const data = await getCustomerReport({ limit });

    createAuditLog({
      entityType: "Report",
      action: AuditAction.READ,
      actionDetails: { report: "customer_summary", filters: { limit } },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(data, "Customer summary report generated.", {
      report: "customer_summary",
      filters: { limit },
    });
  } catch (err) {
    console.error("[ReportController.customerReport]", err);
    return res.status(500).json({ status: "error", message: "Failed to generate customer report." });
  }
}

// ─── GET /api/reports/financial ───────────────────────────────────────────────
/**
 * Financial Summary Report — invoiced vs paid, revenue by month, payment methods
 * Query params: startDate, endDate
 */
export async function financialReport(req: Request, res: Response) {
  try {
    const user = (req as any).user as any;
    const { startDate, endDate } = req.query as Record<string, string>;

    const data = await getFinancialReport({ startDate, endDate });

    createAuditLog({
      entityType: "Report",
      action: AuditAction.READ,
      actionDetails: { report: "financial_summary", filters: { startDate, endDate } },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(data, "Financial summary report generated.", {
      report: "financial_summary",
      filters: { startDate, endDate },
    });
  } catch (err) {
    console.error("[ReportController.financialReport]", err);
    return res.status(500).json({ status: "error", message: "Failed to generate financial report." });
  }
}

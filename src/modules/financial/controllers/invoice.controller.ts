import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { InvoiceStatus } from "../entities/Invoice";
import { paginate, parsePagination } from "../../../utils/helpers";
import {
  createInvoice,
  listAllInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  softDeleteInvoice,
} from "../services/invoice.service";

// ─── POST /api/invoices ───────────────────────────────────────────────────────
export async function createInvoiceHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { shipmentId, items, taxRate, dueDate, notes, currency } = req.body;

    if (!shipmentId || !items || !Array.isArray(items)) {
      return res.status(400).json({ status: "error", message: "Missing required fields: shipmentId and items list." });
    }

    const invoice = await createInvoice({
      shipmentId,
      items,
      taxRate: taxRate !== undefined ? Number(taxRate) : 0,
      dueDate,
      notes,
      currency,
      createdBy: user.id,
    });

    return res.status(201).json({ status: "success", data: invoice });
  } catch (err: any) {
    console.error("[InvoiceController.create]", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal server error." });
  }
}

// ─── GET /api/invoices  (admin — all) ────────────────────────────────────────
export async function listInvoicesHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as InvoiceStatus | undefined;
    const search = req.query.search as string | undefined;

    const [rows, total] = await listAllInvoices({ skip, take: limit, status, search });
    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[InvoiceController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/invoices/:id ────────────────────────────────────────────────────
export async function getInvoiceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      return res.status(404).json({ status: "error", message: "Invoice not found." });
    }

    return res.status(200).json({ status: "success", data: invoice });
  } catch (err) {
    console.error("[InvoiceController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── PATCH /api/invoices/:id/status  (admin) ─────────────────────────────────
export async function updateInvoiceStatusHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status } = req.body as { status: InvoiceStatus };

    const updated = await updateInvoiceStatus(id, status);
    return res.status(200).json({ status: "success", data: updated });
  } catch (err) {
    console.error("[InvoiceController.updateStatus]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/invoices/:id/pdf ────────────────────────────────────────────────
export async function generatePdfHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const invoice = await getInvoiceById(id);
    if (!invoice) return res.status(404).json({ status: "error", message: "Invoice not found." });

    // Stub for PDF generation logic
    // In production, use pdfkit or puppeteer and upload to S3/Cloudinary
    return res.status(200).json({ 
      status: "success", 
      message: "PDF generation triggered.",
      data: { pdfUrl: `https://storage.eaglenet.com/invoices/${invoice.invoiceNumber}.pdf` }
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── DELETE /api/invoices/:id ────────────────────────────────────────────────
export async function deleteInvoiceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await softDeleteInvoice(id);
    return res.status(200).json({ status: "success", message: "Invoice deleted." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

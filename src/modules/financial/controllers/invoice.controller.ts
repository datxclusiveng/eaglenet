import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { InvoiceStatus } from "../entities/Invoice";
import { paginate, parsePagination } from "../../../utils/helpers";
import {
  createInvoice,
  listAllInvoices,
  listUserInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  softDeleteInvoice,
} from "../services/invoice.service";

// ─── POST /api/invoices ───────────────────────────────────────────────────────
export async function createInvoiceHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { amount, tax, shipmentId, dueDate, notes } = req.body;

    const invoice = await createInvoice({
      amount: Number(amount),
      tax: tax !== undefined ? Number(tax) : 0,
      shipmentId,
      dueDate,
      notes,
      createdBy: user.id,
    });

    return res.status(201).json({ status: "success", data: invoice });
  } catch (err) {
    console.error("[InvoiceController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/invoices  (admin — all) ────────────────────────────────────────
export async function listInvoicesHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as InvoiceStatus | undefined;

    const [rows, total] = await listAllInvoices({ skip, take: limit, status });
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

// ─── GET /api/invoices/mine  (customer) ──────────────────────────────────────
export async function myInvoicesHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);

    const [rows, total] = await listUserInvoices(user.id, { skip, take: limit });
    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[InvoiceController.mine]", err);
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

    const existing = await getInvoiceById(id);
    if (!existing) {
      return res.status(404).json({ status: "error", message: "Invoice not found." });
    }

    const updated = await updateInvoiceStatus(id, status);
    return res.status(200).json({ status: "success", data: updated });
  } catch (err) {
    console.error("[InvoiceController.updateStatus]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── DELETE /api/invoices/:id  (admin — soft delete) ─────────────────────────
export async function deleteInvoiceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await getInvoiceById(id);
    if (!existing) {
      return res.status(404).json({ status: "error", message: "Invoice not found." });
    }

    await softDeleteInvoice(id);
    return res.status(200).json({ status: "success", message: "Invoice deleted." });
  } catch (err) {
    console.error("[InvoiceController.delete]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

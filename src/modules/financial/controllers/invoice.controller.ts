import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { InvoiceStatus } from "../entities/Invoice";
import { paginate, parsePagination, sanitizeUser, stripCredentials } from "../../../utils/helpers";
import { UserRole } from "../../users/entities/User";
import {
  createInvoice,
  listAllInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  updateInvoice,
  submitForVerification,
  verifyInvoice,
  approveInvoice,
  rejectInvoice,
  sendInvoice,
  softDeleteInvoice,
} from "../services/invoice.service";

// ─── POST /api/invoices ───────────────────────────────────────────────────────
export async function createInvoiceHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const {
      shipmentId,
      items,
      taxRate,
      dueDate,
      notes,
      currency,
      invoiceFormat,
      bankAccountId,
      shipmentFields,
    } = req.body;

    if (!shipmentId || !items || !Array.isArray(items)) {
      return res.status(400).json({ status: "error", message: "Missing required fields: shipmentId and items list." });
    }

    const invoice = await createInvoice({
      shipmentId,
      items,
      taxRate: taxRate !== undefined ? Number(taxRate) : undefined,
      dueDate,
      notes,
      currency,
      invoiceFormat,
      bankAccountId,
      shipmentFields,
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
    const user = (req as any).user;
    const isSuperAdmin = user?.role === UserRole.SUPERADMIN;
    const sanitizeWorkflow = isSuperAdmin ? stripCredentials : sanitizeUser;
    const sanitized = rows.map((row) => ({
      ...row,
      creator: row.creator ? sanitizeUser(row.creator) : null,
      preparedBy: row.preparedBy ? sanitizeWorkflow(row.preparedBy) : null,
      verifiedBy: row.verifiedBy ? sanitizeWorkflow(row.verifiedBy) : null,
      approvedBy: row.approvedBy ? sanitizeWorkflow(row.approvedBy) : null,
    }));
    return res.status(200).json({
      status: "success",
      data: sanitized,
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

    const user = (req as any).user;
    const isSuperAdmin = user?.role === UserRole.SUPERADMIN;
    const sanitizeWorkflow = isSuperAdmin ? stripCredentials : sanitizeUser;

    return res.status(200).json({
      status: "success",
      data: {
        ...invoice,
        creator: invoice.creator ? sanitizeUser(invoice.creator) : null,
        preparedBy: invoice.preparedBy ? sanitizeWorkflow(invoice.preparedBy) : null,
        verifiedBy: invoice.verifiedBy ? sanitizeWorkflow(invoice.verifiedBy) : null,
        approvedBy: invoice.approvedBy ? sanitizeWorkflow(invoice.approvedBy) : null,
      },
    });
  } catch (err) {
    console.error("[InvoiceController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── PUT /api/invoices/:id  (update draft) ────────────────────────────────────
export async function updateInvoiceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const updated = await updateInvoice(id, req.body);
    return res.status(200).json({ status: "success", data: updated });
  } catch (err: any) {
    console.error("[InvoiceController.update]", err);
    const status = err.message.includes("Only draft") ? 400 : 500;
    return res.status(status).json({ status: "error", message: err.message || "Internal server error." });
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

// ─── POST /api/invoices/:id/submit ────────────────────────────────────────────
export async function submitForVerificationHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;
    const invoice = await submitForVerification(id, user.id);
    return res.status(200).json({ status: "success", data: invoice });
  } catch (err: any) {
    console.error("[InvoiceController.submit]", err);
    const status = err.message.includes("Cannot submit") || err.message.includes("no line items") ? 400 : 500;
    return res.status(status).json({ status: "error", message: err.message || "Internal server error." });
  }
}

// ─── POST /api/invoices/:id/verify ────────────────────────────────────────────
export async function verifyInvoiceHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;
    const invoice = await verifyInvoice(id, user.id, user.role);
    return res.status(200).json({ status: "success", data: invoice });
  } catch (err: any) {
    console.error("[InvoiceController.verify]", err);
    const status = err.message.includes("Cannot verify") || err.message.includes("different user") ? 400 : 500;
    return res.status(status).json({ status: "error", message: err.message || "Internal server error." });
  }
}

// ─── POST /api/invoices/:id/approve ───────────────────────────────────────────
export async function approveInvoiceHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;
    const invoice = await approveInvoice(id, user.id, user.role);
    return res.status(200).json({ status: "success", data: invoice });
  } catch (err: any) {
    console.error("[InvoiceController.approve]", err);
    const status =
      err.message.includes("Cannot approve") ||
      err.message.includes("different user") ||
      err.message.includes("Only admins")
        ? 400 : 500;
    return res.status(status).json({ status: "error", message: err.message || "Internal server error." });
  }
}

// ─── POST /api/invoices/:id/reject ────────────────────────────────────────────
export async function rejectInvoiceHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const id = req.params.id as string;
    const { reason } = req.body;
    const invoice = await rejectInvoice(id, user.id, reason);
    return res.status(200).json({ status: "success", data: invoice });
  } catch (err: any) {
    console.error("[InvoiceController.reject]", err);
    const status = err.message.includes("Cannot reject") ? 400 : 500;
    return res.status(status).json({ status: "error", message: err.message || "Internal server error." });
  }
}

// ─── POST /api/invoices/:id/send ──────────────────────────────────────────────
export async function sendInvoiceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const invoice = await sendInvoice(id);
    return res.status(200).json({ status: "success", data: invoice });
  } catch (err: any) {
    console.error("[InvoiceController.send]", err);
    const status = err.message.includes("Cannot send") ? 400 : 500;
    return res.status(status).json({ status: "error", message: err.message || "Internal server error." });
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

import { AppDataSource } from "../../../../database/data-source";
import { Invoice, InvoiceStatus } from "../entities/Invoice";
import { PaymentStatus } from "../entities/Payment";

const invoiceRepo = () => AppDataSource.getRepository(Invoice);

// ─── Generate invoice number ────────────────────────────────────────────────
async function generateInvoiceNumber(): Promise<string> {
  const count = await invoiceRepo().count({ withDeleted: true });
  const seq = String(count + 1).padStart(5, "0");
  return `EGL-INV-${seq}`;
}

// ─── Create an invoice ───────────────────────────────────────────────────────
export async function createInvoice(data: {
  amount: number;
  tax?: number;
  shipmentId?: string;
  dueDate?: string;
  notes?: string;
  createdBy: string;
}): Promise<Invoice> {
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = invoiceRepo().create({
    invoiceNumber,
    amount: data.amount,
    tax: data.tax ?? 0,
    shipmentId: data.shipmentId,
    dueDate: data.dueDate,
    notes: data.notes,
    createdBy: data.createdBy,
    status: InvoiceStatus.DRAFT,
  });

  return invoiceRepo().save(invoice);
}

// ─── List all invoices (admin) ───────────────────────────────────────────────
export async function listAllInvoices(opts: {
  skip: number;
  take: number;
  status?: InvoiceStatus;
}): Promise<[Invoice[], number]> {
  const qb = invoiceRepo()
    .createQueryBuilder("inv")
    .leftJoinAndSelect("inv.shipment", "s")
    .leftJoinAndSelect("inv.creator", "c")
    .leftJoinAndSelect("inv.payments", "p")
    .orderBy("inv.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  if (opts.status) {
    qb.where("inv.status = :status", { status: opts.status });
  }

  return qb.getManyAndCount();
}

// ─── List invoices for a customer ────────────────────────────────────────────
export async function listUserInvoices(
  userId: string,
  opts: { skip: number; take: number }
): Promise<[Invoice[], number]> {
  // Customer can only see invoices tied to their shipments
  return invoiceRepo()
    .createQueryBuilder("inv")
    .leftJoinAndSelect("inv.shipment", "s")
    .leftJoinAndSelect("inv.payments", "p")
    .where("s.userId = :userId", { userId })
    .orderBy("inv.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take)
    .getManyAndCount();
}

// ─── Get single invoice ───────────────────────────────────────────────────────
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  return invoiceRepo().findOne({
    where: { id },
    relations: ["shipment", "creator", "payments", "payments.user"],
  });
}

// ─── Update invoice status ────────────────────────────────────────────────────
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id } });
  invoice.status = status;
  return invoiceRepo().save(invoice);
}

// ─── Delete (soft) an invoice ─────────────────────────────────────────────────
export async function softDeleteInvoice(id: string): Promise<void> {
  await invoiceRepo().softDelete(id);
}

// ─── Reconcile: recompute status based on linked payments ────────────────────
/**
 * Called after a payment succeeds. Checks if total paid >= invoice amount
 * and automatically marks it PAID or PARTIAL.
 */
export async function reconcileInvoice(invoiceId: string): Promise<void> {
  const invoice = await invoiceRepo().findOne({
    where: { id: invoiceId },
    relations: ["payments"],
  });
  if (!invoice) return;

  const totalPaid = invoice.payments
    .filter((p) => p.status === PaymentStatus.SUCCESS)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalDue = Number(invoice.amount) + Number(invoice.tax);

  if (totalPaid >= totalDue) {
    invoice.status = InvoiceStatus.PAID;
  } else if (totalPaid > 0) {
    invoice.status = InvoiceStatus.PARTIAL;
  }

  await invoiceRepo().save(invoice);
}

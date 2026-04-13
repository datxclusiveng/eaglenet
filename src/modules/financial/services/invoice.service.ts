import { AppDataSource } from "../../../../database/data-source";
import { Invoice, InvoiceStatus } from "../entities/Invoice";
import { Shipment } from "../../shipments/entities/Shipment";
import { generateInvoiceNumber } from "../../shipments/utils/generators";
import { MoreThanOrEqual } from "typeorm";

const invoiceRepo = () => AppDataSource.getRepository(Invoice);
const shipmentRepo = () => AppDataSource.getRepository(Shipment);

// ─── Create an invoice ───────────────────────────────────────────────────────
export async function createInvoice(data: {
  shipmentId: string;
  items: any[];
  taxRate?: number;
  dueDate?: string;
  notes?: string;
  createdBy: string;
  currency?: string;
}): Promise<Invoice> {
  const shipment = await shipmentRepo().findOneBy({ id: data.shipmentId });
  if (!shipment) throw new Error("Shipment not found.");

  // Get daily count for sequential naming
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await invoiceRepo().count({
    where: {
      createdAt: MoreThanOrEqual(today)
    }
  });

  const invoiceNumber = generateInvoiceNumber(count + 1);

  // Financial calculations
  const subtotal = data.items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0);
  const taxRate = data.taxRate ?? 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  const invoice = invoiceRepo().create({
    invoiceNumber,
    shipmentId: data.shipmentId,
    items: data.items,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    dueDate: data.dueDate,
    notes: data.notes,
    createdBy: data.createdBy,
    status: InvoiceStatus.DRAFT,
  });

  return invoiceRepo().save(invoice);
}

// ─── List all invoices (filtered) ───────────────────────────────────────────
export async function listAllInvoices(opts: {
  skip: number;
  take: number;
  status?: InvoiceStatus;
  search?: string;
}): Promise<[Invoice[], number]> {
  const qb = invoiceRepo()
    .createQueryBuilder("inv")
    .leftJoinAndSelect("inv.shipment", "s")
    .leftJoinAndSelect("inv.createdBy", "c")
    .orderBy("inv.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  if (opts.status) {
    qb.andWhere("inv.status = :status", { status: opts.status });
  }

  if (opts.search) {
    qb.andWhere("(inv.invoiceNumber ILIKE :s OR s.trackingNumber ILIKE :s OR s.clientName ILIKE :s)", { s: `%${opts.search}%` });
  }

  return qb.getManyAndCount();
}

// ─── Get single invoice ───────────────────────────────────────────────────────
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  return invoiceRepo().findOne({
    where: { id },
    relations: ["shipment", "createdBy"],
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function reconcileInvoice(_invoiceId: string): Promise<void> {
  // To be implemented in Phase 4 during payment integration
  // This will check transaction logs and mark PAID if total >= totalAmount
}

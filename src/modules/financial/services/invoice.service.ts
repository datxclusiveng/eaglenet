import { AppDataSource } from "../../../../database/data-source";
import { Invoice, InvoiceStatus, InvoiceItem, BankDetails } from "../entities/Invoice";
import { BankAccount, BankAccountType } from "../entities/BankAccount";
import { Shipment, ShipmentType } from "../../shipments/entities/Shipment";
import { PaymentStatus } from "../entities/Payment";
import { generateInvoiceNumber } from "../../shipments/utils/generators";
import { MoreThanOrEqual } from "typeorm";
import { UserRole } from "../../users/entities/User";

const invoiceRepo = () => AppDataSource.getRepository(Invoice);
const shipmentRepo = () => AppDataSource.getRepository(Shipment);
const bankAccountRepo = () => AppDataSource.getRepository(BankAccount);


// ─── Create an invoice ───────────────────────────────────────────────────────
export async function createInvoice(data: {
  shipmentId: string;
  items: Array<{ description: string; quantity: number; price: number }>;
  taxRate?: number;
  dueDate?: string;
  notes?: string;
  createdBy: string;
  currency?: string;
  invoiceFormat?: "naira" | "foreign";
  bankAccountId?: string;
  shipmentFields?: {
    fileNumber?: string;
    yourRef?: string;
    numberOfPackages?: number;
    grossWeight?: number;
    chargeableWeight?: number;
    cubit?: number;
    awbBlNumber?: string;
    jobDescription?: string;
  };
}): Promise<Invoice> {
  const shipment = await shipmentRepo().findOneBy({ id: data.shipmentId });
  if (!shipment) throw new Error("Shipment not found.");

  // Determine format and currency
  const invoiceFormat = data.invoiceFormat
    || (shipment.type === ShipmentType.EXPORT ? "foreign" : "naira");
  const currency = data.currency
    || (invoiceFormat === "foreign" ? "USD" : "NGN");

  // Get daily count for sequential numbering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await invoiceRepo().count({
    where: { createdAt: MoreThanOrEqual(today) },
    withDeleted: true,
  });

  const invoiceNumber = generateInvoiceNumber(count + 1);

  // Build items with SN
  const items: InvoiceItem[] = data.items.map((item, idx) => ({
    sn: idx + 1,
    description: item.description,
    quantity: item.quantity,
    price: item.price,
    total: item.price * item.quantity,
  }));

  // Financial calculations
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = data.taxRate ?? 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  // Auto-populate logistics fields from shipment
  const fileNumber = data.shipmentFields?.fileNumber ?? shipment.trackingNumber;
  const awbBlNumber = data.shipmentFields?.awbBlNumber ?? shipment.flightOrVoyageNumber;
  const grossWeight = data.shipmentFields?.grossWeight ?? (shipment.weightKg ? Number(shipment.weightKg) : undefined);
  const cubit = data.shipmentFields?.cubit ?? (shipment.volumeCbm ? Number(shipment.volumeCbm) : undefined);
  const jobDescription = data.shipmentFields?.jobDescription
    ?? shipment.description
    ?? `Freight services for ${shipment.shipmentName}`;
  const yourRef = data.shipmentFields?.yourRef ?? shipment.internalReference;
  const numberOfPackages = data.shipmentFields?.numberOfPackages ?? undefined;
  const chargeableWeight = data.shipmentFields?.chargeableWeight ?? undefined;

  // Resolve bank account and snapshot details
  let bankAccountId: string | undefined = data.bankAccountId;
  let bankDetails: BankDetails | undefined;

  if (bankAccountId) {
    const bankAccount = await bankAccountRepo().findOneBy({ id: bankAccountId });
    if (bankAccount) {
      bankDetails = buildBankDetailsSnapshot(bankAccount);
    }
  } else {
    // Auto-select default bank account for this format/currency
    const accountType = invoiceFormat === "foreign" ? BankAccountType.FOREIGN : BankAccountType.LOCAL;
    const defaultAccount = await bankAccountRepo().findOne({
      where: { accountType, currency, isDefault: true, isActive: true },
    });
    if (defaultAccount) {
      bankAccountId = defaultAccount.id;
      bankDetails = buildBankDetailsSnapshot(defaultAccount);
    }
  }

  const invoice = invoiceRepo().create({
    invoiceNumber,
    shipmentId: data.shipmentId,
    clientName: data.shipmentFields?.yourRef ? undefined : shipment.clientName, // will be overwritten if not provided
    clientEmail: shipment.clientEmail,
    fileNumber,
    yourRef,
    awbBlNumber,
    numberOfPackages,
    grossWeight,
    chargeableWeight,
    cubit,
    jobDescription,
    invoiceFormat,
    items,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    currency,
    dueDate: data.dueDate,
    notes: data.notes,
    createdBy: data.createdBy,
    bankAccountId,
    bankDetails,
    status: InvoiceStatus.DRAFT,
  });

  return invoiceRepo().save(invoice);
}

// ─── Update a draft invoice ──────────────────────────────────────────────────
export async function updateInvoice(
  id: string,
  data: Partial<{
    fileNumber: string;
    yourRef: string;
    numberOfPackages: number;
    grossWeight: number;
    chargeableWeight: number;
    cubit: number;
    awbBlNumber: string;
    jobDescription: string;
    items: Array<{ description: string; quantity: number; price: number }>;
    taxRate: number;
    dueDate: string;
    notes: string;
    currency: string;
    invoiceFormat: "naira" | "foreign";
    bankAccountId: string;
    clientName: string;
    clientEmail: string;
  }>
): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id } });

  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error("Only draft invoices can be edited.");
  }

  // If items changed, rebuild with SN and recalculate totals
  if (data.items) {
    const taxRate = data.taxRate !== undefined ? data.taxRate : Number(invoice.taxRate);
    invoice.items = data.items.map((item, idx) => ({
      sn: idx + 1,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
    }));
    invoice.subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
    invoice.taxRate = taxRate;
    invoice.taxAmount = (invoice.subtotal * taxRate) / 100;
    invoice.totalAmount = invoice.subtotal + invoice.taxAmount;
  } else if (data.taxRate !== undefined) {
    const taxRate = data.taxRate;
    invoice.taxRate = taxRate;
    invoice.taxAmount = (Number(invoice.subtotal) * taxRate) / 100;
    invoice.totalAmount = Number(invoice.subtotal) + invoice.taxAmount;
  }

  // If bank account changed, re-snapshot
  if (data.bankAccountId && data.bankAccountId !== invoice.bankAccountId) {
    const bankAccount = await bankAccountRepo().findOneBy({ id: data.bankAccountId });
    if (bankAccount) {
      invoice.bankAccountId = bankAccount.id;
      invoice.bankDetails = buildBankDetailsSnapshot(bankAccount);
    }
  }

  // Apply scalar fields
  const scalarFields: Array<keyof typeof data> = [
    "fileNumber", "yourRef", "numberOfPackages", "grossWeight",
    "chargeableWeight", "cubit", "awbBlNumber", "jobDescription",
    "dueDate", "notes", "currency", "invoiceFormat", "clientName", "clientEmail",
  ];
  for (const field of scalarFields) {
    if (data[field] !== undefined) {
      (invoice as any)[field] = data[field];
    }
  }

  return invoiceRepo().save(invoice);
}

// ─── Workflow: Submit for verification ───────────────────────────────────────
export async function submitForVerification(invoiceId: string, userId: string): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id: invoiceId } });

  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error(`Cannot submit invoice with status "${invoice.status}". Only draft invoices can be submitted.`);
  }

  if (!invoice.items || invoice.items.length === 0) {
    throw new Error("Cannot submit an invoice with no line items.");
  }

  invoice.status = InvoiceStatus.PENDING_VERIFICATION;
  invoice.preparedById = userId;
  invoice.preparedAt = new Date();

  return invoiceRepo().save(invoice);
}

// ─── Workflow: Verify ────────────────────────────────────────────────────────
export async function verifyInvoice(invoiceId: string, userId: string, userRole?: UserRole): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id: invoiceId } });

  if (invoice.status !== InvoiceStatus.PENDING_VERIFICATION) {
    throw new Error(`Cannot verify invoice with status "${invoice.status}".`);
  }

  const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;

  if (invoice.preparedById === userId && !isAdmin) {
    throw new Error("Verifier must be a different user from the preparer.");
  }

  invoice.status = InvoiceStatus.PENDING_APPROVAL;
  invoice.verifiedById = userId;
  invoice.verifiedAt = new Date();

  return invoiceRepo().save(invoice);
}

// ─── Workflow: Approve ───────────────────────────────────────────────────────
export async function approveInvoice(invoiceId: string, userId: string, userRole: UserRole): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id: invoiceId } });

  if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
    throw new Error(`Cannot approve invoice with status "${invoice.status}".`);
  }

  const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;

  if (invoice.verifiedById === userId && !isAdmin) {
    throw new Error("Approver must be a different user from the verifier.");
  }

  if (!isAdmin) {
    throw new Error("Only admins can approve invoices.");
  }

  invoice.status = InvoiceStatus.APPROVED;
  invoice.approvedById = userId;
  invoice.approvedAt = new Date();

  return invoiceRepo().save(invoice);
}

// ─── Workflow: Reject ────────────────────────────────────────────────────────
export async function rejectInvoice(invoiceId: string, userId: string, reason: string): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id: invoiceId } });

  if (
    invoice.status !== InvoiceStatus.PENDING_VERIFICATION &&
    invoice.status !== InvoiceStatus.PENDING_APPROVAL &&
    invoice.status !== InvoiceStatus.APPROVED
  ) {
    throw new Error(`Cannot reject invoice with status "${invoice.status}".`);
  }

  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  const rejectionNote = `\n[REJECTED ${timestamp} by ${userId}]: ${reason}`;
  invoice.notes = (invoice.notes || "") + rejectionNote;
  invoice.status = InvoiceStatus.DRAFT;

  return invoiceRepo().save(invoice);
}

// ─── Workflow: Send ──────────────────────────────────────────────────────────
export async function sendInvoice(invoiceId: string): Promise<Invoice> {
  const invoice = await invoiceRepo().findOneOrFail({ where: { id: invoiceId } });

  if (invoice.status !== InvoiceStatus.APPROVED) {
    throw new Error(`Cannot send invoice with status "${invoice.status}". Invoice must be approved first.`);
  }

  invoice.status = InvoiceStatus.SENT;
  invoice.issuedAt = new Date();

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
    .leftJoinAndSelect("inv.creator", "c")
    .leftJoinAndSelect("inv.preparedBy", "pb")
    .leftJoinAndSelect("inv.verifiedBy", "vb")
    .leftJoinAndSelect("inv.approvedBy", "ab")
    .orderBy("inv.createdAt", "DESC")
    .skip(opts.skip)
    .take(opts.take);

  if (opts.status) {
    qb.andWhere("inv.status = :status", { status: opts.status });
  }

  if (opts.search) {
    qb.andWhere(
      "(inv.invoiceNumber ILIKE :s OR s.trackingNumber ILIKE :s OR s.clientName ILIKE :s OR inv.fileNumber ILIKE :s)",
      { s: `%${opts.search}%` }
    );
  }

  return qb.getManyAndCount();
}

// ─── Get single invoice ───────────────────────────────────────────────────────
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  return invoiceRepo().findOne({
    where: { id },
    relations: [
      "shipment",
      "creator",
      "bankAccount",
      "preparedBy",
      "verifiedBy",
      "approvedBy",
      "payments",
    ],
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
export async function reconcileInvoice(invoiceId: string): Promise<void> {
  const invoice = await invoiceRepo().findOne({
    where: { id: invoiceId },
    relations: ["payments"],
  });
  if (!invoice) return;

  const totalPaid = invoice.payments
    .filter((p) => p.status === PaymentStatus.SUCCESS)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalAmount = Number(invoice.totalAmount);

  if (totalPaid >= totalAmount && totalAmount > 0) {
    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
  } else if (totalPaid > 0 && totalPaid < totalAmount && invoice.status === InvoiceStatus.PAID) {
    // Was marked paid but no longer fully paid — revert to sent
    invoice.status = InvoiceStatus.SENT;
    invoice.paidAt = undefined as any;
  }

  // Check overdue
  if (
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date() &&
    invoice.status !== InvoiceStatus.PAID &&
    invoice.status !== InvoiceStatus.CANCELLED &&
    invoice.status !== InvoiceStatus.DRAFT &&
    invoice.status !== InvoiceStatus.OVERDUE
  ) {
    invoice.status = InvoiceStatus.OVERDUE;
  }

  await invoiceRepo().save(invoice);
}

// ─── Mark overdue invoices (cron job) ────────────────────────────────────────
export async function markOverdueInvoices(): Promise<number> {
  const result = await invoiceRepo()
    .createQueryBuilder()
    .update(Invoice)
    .set({ status: InvoiceStatus.OVERDUE })
    .where("status IN (:...activeStatuses)", {
      activeStatuses: [InvoiceStatus.SENT, InvoiceStatus.APPROVED],
    })
    .andWhere("due_date < :now", { now: new Date().toISOString().split("T")[0] })
    .execute();
  return result.affected || 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBankDetailsSnapshot(account: BankAccount): BankDetails {
  return {
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    bankAddress: account.bankAddress || undefined,
    sortCode: account.sortCode || undefined,
    swiftCode: account.swiftCode || undefined,
    intermediaryBank: account.intermediaryBank || undefined,
    intermediarySwift: account.intermediarySwift || undefined,
    tin: account.tin || undefined,
    additionalInfo: account.additionalInfo || undefined,
  };
}

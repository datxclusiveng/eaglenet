import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus } from "../../shipments/entities/Shipment";
import { Invoice, InvoiceStatus } from "../../financial/entities/Invoice";
import { Payment, PaymentStatus } from "../../financial/entities/Payment";
import { Customer } from "../../customers/entities/Customer";

// ─── Shared date filter helper ─────────────────────────────────────────────────
function applyDateRange(qb: any, alias: string, startDate?: string, endDate?: string) {
  if (startDate) qb.andWhere(`${alias}.createdAt >= :startDate`, { startDate: new Date(startDate) });
  if (endDate) qb.andWhere(`${alias}.createdAt <= :endDate`, { endDate: new Date(endDate) });
}

// ─── 1. Shipment Summary Report ───────────────────────────────────────────────
export interface ShipmentReportOptions {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  type?: string;
}

export async function getShipmentReport(opts: ShipmentReportOptions) {
  const repo = AppDataSource.getRepository(Shipment);

  // Status breakdown
  const statusQb = repo.createQueryBuilder("s");
  if (opts.departmentId) statusQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  if (opts.type) statusQb.andWhere("s.type = :type", { type: opts.type });
  applyDateRange(statusQb, "s", opts.startDate, opts.endDate);

  const byStatus = await statusQb
    .select("s.status", "status")
    .addSelect("COUNT(s.id)", "count")
    .groupBy("s.status")
    .getRawMany();

  // Type breakdown (import vs export)
  const typeQb = repo.createQueryBuilder("s");
  if (opts.departmentId) typeQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  applyDateRange(typeQb, "s", opts.startDate, opts.endDate);

  const byType = await typeQb
    .select("s.type", "type")
    .addSelect("COUNT(s.id)", "count")
    .groupBy("s.type")
    .getRawMany();

  // Top routes (origin → destination)
  const routeQb = repo.createQueryBuilder("s");
  if (opts.departmentId) routeQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  if (opts.type) routeQb.andWhere("s.type = :type", { type: opts.type });
  applyDateRange(routeQb, "s", opts.startDate, opts.endDate);

  const topRoutes = await routeQb
    .select("s.originCountry", "originCountry")
    .addSelect("s.originCity", "originCity")
    .addSelect("s.destinationCountry", "destinationCountry")
    .addSelect("s.destinationCity", "destinationCity")
    .addSelect("COUNT(s.id)", "count")
    .where("s.originCountry IS NOT NULL AND s.destinationCountry IS NOT NULL")
    .groupBy("s.originCountry, s.originCity, s.destinationCountry, s.destinationCity")
    .orderBy("count", "DESC")
    .limit(10)
    .getRawMany();

  // Monthly volume (last 12 months)
  const monthlyQb = repo.createQueryBuilder("s");
  if (opts.departmentId) monthlyQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  if (opts.type) monthlyQb.andWhere("s.type = :type", { type: opts.type });
  monthlyQb.andWhere("s.createdAt >= NOW() - INTERVAL '12 months'");

  const monthlyVolume = await monthlyQb
    .select("TO_CHAR(s.createdAt, 'YYYY-MM')", "month")
    .addSelect("COUNT(s.id)", "count")
    .groupBy("month")
    .orderBy("month", "ASC")
    .getRawMany();

  const total = byStatus.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

  return { total, byStatus, byType, topRoutes, monthlyVolume };
}

// ─── 2. Performance Report ────────────────────────────────────────────────────
export interface PerformanceReportOptions {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}

export async function getPerformanceReport(opts: PerformanceReportOptions) {
  const repo = AppDataSource.getRepository(Shipment);

  // On-time delivery rate
  const deliveredQb = repo.createQueryBuilder("s")
    .where("s.status = :status", { status: ShipmentStatus.DELIVERED });
  if (opts.departmentId) deliveredQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  applyDateRange(deliveredQb, "s", opts.startDate, opts.endDate);

  const totalDelivered = await deliveredQb.getCount();

  const onTimeQb = repo.createQueryBuilder("s")
    .where("s.status = :status", { status: ShipmentStatus.DELIVERED })
    .andWhere("s.actualDeliveryDate IS NOT NULL")
    .andWhere("s.expectedDeliveryDate IS NOT NULL")
    .andWhere("s.actualDeliveryDate <= s.expectedDeliveryDate");
  if (opts.departmentId) onTimeQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  applyDateRange(onTimeQb, "s", opts.startDate, opts.endDate);

  const totalOnTime = await onTimeQb.getCount();
  const onTimeRate = totalDelivered > 0
    ? parseFloat(((totalOnTime / totalDelivered) * 100).toFixed(2))
    : 0;

  // Per-department breakdown
  const deptQb = repo.createQueryBuilder("s")
    .leftJoin("s.department", "dept")
    .select("dept.name", "department")
    .addSelect("COUNT(s.id)", "total")
    .addSelect(
      "COUNT(CASE WHEN s.status = 'delivered' THEN 1 END)",
      "delivered"
    )
    .addSelect(
      "COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END)",
      "cancelled"
    )
    .where("dept.id IS NOT NULL")
    .groupBy("dept.name")
    .orderBy("total", "DESC");
  applyDateRange(deptQb, "s", opts.startDate, opts.endDate);

  const byDepartment = await deptQb.getRawMany();

  // Status funnel
  const funnelQb = repo.createQueryBuilder("s");
  if (opts.departmentId) funnelQb.andWhere("s.departmentId = :deptId", { deptId: opts.departmentId });
  applyDateRange(funnelQb, "s", opts.startDate, opts.endDate);
  const funnel = await funnelQb
    .select("s.status", "status")
    .addSelect("COUNT(s.id)", "count")
    .groupBy("s.status")
    .getRawMany();

  return {
    totalDelivered,
    totalOnTime,
    onTimeRate,
    byDepartment,
    statusFunnel: funnel,
  };
}

// ─── 3. Customer Report ───────────────────────────────────────────────────────
export interface CustomerReportOptions {
  limit?: number;
}

export async function getCustomerReport(opts: CustomerReportOptions = {}) {
  const limit = opts.limit || 10;
  const repo = AppDataSource.getRepository(Shipment);

  // Top customers by shipment volume
  const topQb = repo.createQueryBuilder("s")
    .select("s.clientName", "clientName")
    .addSelect("s.clientEmail", "clientEmail")
    .addSelect("COUNT(s.id)", "totalShipments")
    .addSelect(
      "COUNT(CASE WHEN s.status = 'delivered' THEN 1 END)",
      "delivered"
    )
    .addSelect(
      "COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END)",
      "cancelled"
    )
    .where("s.clientEmail IS NOT NULL")
    .groupBy("s.clientName, s.clientEmail")
    .orderBy("\"totalShipments\"", "DESC")
    .limit(limit);

  const topCustomers = await topQb.getRawMany();

  // Total registered customers
  const totalCustomers = await AppDataSource.getRepository(Customer).count();

  // Shipments with no customer email (unregistered)
  const unregistered = await repo.count({ where: { clientEmail: undefined } });

  return { totalCustomers, unregistered, topCustomers };
}

// ─── 4. Financial Summary Report ──────────────────────────────────────────────
export interface FinancialReportOptions {
  startDate?: string;
  endDate?: string;
}

export async function getFinancialReport(opts: FinancialReportOptions = {}) {
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const paymentRepo = AppDataSource.getRepository(Payment);

  // Invoice totals by status
  const invoiceQb = invoiceRepo.createQueryBuilder("i")
    .where("i.isDeleted = false");
  applyDateRange(invoiceQb, "i", opts.startDate, opts.endDate);

  const invoiceSummary = await invoiceQb
    .select("i.status", "status")
    .addSelect("COUNT(i.id)", "count")
    .addSelect("COALESCE(SUM(i.totalAmount), 0)", "totalAmount")
    .addSelect("i.currency", "currency")
    .groupBy("i.status, i.currency")
    .getRawMany();

  // Total invoiced vs total paid
  const totals = invoiceSummary.reduce(
    (acc: any, row: any) => {
      const amount = parseFloat(row.totalAmount);
      acc.totalInvoiced += amount;
      if (row.status === InvoiceStatus.PAID) acc.totalPaid += amount;
      if (row.status === InvoiceStatus.OVERDUE) acc.totalOverdue += amount;
      if (row.status === InvoiceStatus.SENT) acc.totalOutstanding += amount;
      return acc;
    },
    { totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, totalOutstanding: 0 }
  );

  // Monthly revenue (last 12 months) — paid invoices only
  const revenueQb = invoiceRepo.createQueryBuilder("i")
    .where("i.status = :status", { status: InvoiceStatus.PAID })
    .andWhere("i.isDeleted = false")
    .andWhere("i.paidAt >= NOW() - INTERVAL '12 months'");

  const monthlyRevenue = await revenueQb
    .select("TO_CHAR(i.paidAt, 'YYYY-MM')", "month")
    .addSelect("COALESCE(SUM(i.totalAmount), 0)", "revenue")
    .addSelect("i.currency", "currency")
    .groupBy("month, i.currency")
    .orderBy("month", "ASC")
    .getRawMany();

  // Payment method breakdown (successful payments)
  const paymentQb = paymentRepo.createQueryBuilder("p")
    .where("p.status = :status", { status: PaymentStatus.SUCCESS });
  applyDateRange(paymentQb, "p", opts.startDate, opts.endDate);

  const paymentMethods = await paymentQb
    .select("p.paymentMethod", "method")
    .addSelect("COUNT(p.id)", "count")
    .addSelect("COALESCE(SUM(p.amount), 0)", "totalAmount")
    .groupBy("p.paymentMethod")
    .getRawMany();

  return {
    ...totals,
    invoiceSummary,
    monthlyRevenue,
    paymentMethods,
  };
}

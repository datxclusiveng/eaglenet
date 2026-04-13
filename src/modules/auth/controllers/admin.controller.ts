import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus } from "../../shipments/entities/Shipment";
import { Payment } from "../../financial/entities/Payment";
import { User, UserRole } from "../../users/entities/User";

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export async function getDashboardStats(_req: Request, res: Response) {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);

    const [totalUsers, totalOrders] = await Promise.all([
      userRepo.count({ where: { role: UserRole.CUSTOMER } }),
      shipmentRepo.count(),
    ]);

    // Shipment status counts
    const statusCounts = await shipmentRepo
      .createQueryBuilder("s")
      .select("s.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("s.status")
      .getRawMany();

    const statusMap: Record<string, number> = {
      [ShipmentStatus.PENDING]: 0,
      [ShipmentStatus.IN_TRANSIT]: 0,
      [ShipmentStatus.ARRIVED]: 0,
      [ShipmentStatus.DELIVERED]: 0,
      [ShipmentStatus.ON_HOLD]: 0,
      [ShipmentStatus.CANCELLED]: 0,
    };
    for (const row of statusCounts) {
      if (statusMap[row.status] !== undefined) {
        statusMap[row.status] = Number(row.count);
      }
    }

    // Revenue
    const revenueResult = await paymentRepo
      .createQueryBuilder("p")
      .select("COALESCE(SUM(p.amount), 0)", "totalRevenue")
      .where("p.status = 'SUCCESS'")
      .getRawOne();

    return res.status(200).json({
      status: "success",
      data: {
        totalUsers,
        totalOrders,
        inTransit: statusMap[ShipmentStatus.IN_TRANSIT],
        pending: statusMap[ShipmentStatus.PENDING],
        processing: statusMap[ShipmentStatus.ON_HOLD],
        arrived: statusMap[ShipmentStatus.ARRIVED],
        delivered: statusMap[ShipmentStatus.DELIVERED],
        cancelled: statusMap[ShipmentStatus.CANCELLED],
        totalRevenue: Number(revenueResult.totalRevenue),
        // Chart data
        pieChart: [
          {
            label: "Pending",
            value: statusMap[ShipmentStatus.PENDING],
            color: "#64748b",
          },
          {
            label: "In Transit",
            value: statusMap[ShipmentStatus.IN_TRANSIT],
            color: "#3b82f6",
          },
          {
            label: "Arrived",
            value: statusMap[ShipmentStatus.ARRIVED],
            color: "#14b8a6",
          },
          {
            label: "Delivered",
            value: statusMap[ShipmentStatus.DELIVERED],
            color: "#10b981",
          },
        ],
        barChart: Object.entries(statusMap).map(([label, value]) => ({
          label,
          value,
        })),
      },
    });
  } catch (err) {
    console.error("[AdminController.getDashboardStats]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Monthly Report ────────────────────────────────────────────────────

export async function getMonthlyReport(req: Request, res: Response) {
  try {
    const year = parseInt(
      (req.query.year as string) || String(new Date().getFullYear()),
    );
    const month = parseInt(
      (req.query.month as string) || String(new Date().getMonth() + 1),
    );

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);
    const userRepo = AppDataSource.getRepository(User);

    const [totalBookings, newCustomers, deliveredCount] = await Promise.all([
      // Total bookings this month
      shipmentRepo
        .createQueryBuilder("s")
        .where("s.createdAt BETWEEN :start AND :end", {
          start: startDate,
          end: endDate,
        })
        .getCount(),
      // New customers this month
      userRepo
        .createQueryBuilder("u")
        .where("u.role = :role", { role: UserRole.CUSTOMER })
        .andWhere("u.createdAt BETWEEN :start AND :end", {
          start: startDate,
          end: endDate,
        })
        .getCount(),
      // Delivered this month
      shipmentRepo
        .createQueryBuilder("s")
        .where("s.status = :status", { status: ShipmentStatus.DELIVERED })
        .andWhere("s.updatedAt BETWEEN :start AND :end", {
          start: startDate,
          end: endDate,
        })
        .getCount(),
    ]);

    // Total revenue this month
    const revenueResult = await paymentRepo
      .createQueryBuilder("p")
      .select("COALESCE(SUM(p.amount), 0)", "revenue")
      .where("p.status = 'SUCCESS'")
      .andWhere("p.createdAt BETWEEN :start AND :end", {
        start: startDate,
        end: endDate,
      })
      .getRawOne();

    const totalRevenue = Number(revenueResult.revenue);

    // Compute report readiness %: deliveries vs bookings
    const reportReady =
      totalBookings === 0
        ? 0
        : Math.round((deliveredCount / totalBookings) * 100);

    return res.status(200).json({
      status: "success",
      data: {
        year,
        month,
        totalBookings,
        newCustomers,
        totalRevenue,
        reportReady,
      },
    });
  } catch (err) {
    console.error("[AdminController.getMonthlyReport]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

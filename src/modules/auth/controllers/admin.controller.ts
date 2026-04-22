import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Shipment, ShipmentStatus } from "../../shipments/entities/Shipment";
import { Payment } from "../../financial/entities/Payment";
import { User, UserRole } from "../../users/entities/User";
import { AuditLog } from "../../audit/entities/AuditLog";
import { PermissionScope } from "../../permissions/entities/Permission";
import { parsePagination, paginate } from "../../../utils/helpers";

import { appCache, CacheKeys } from "../../../utils/cache";
import { serializeUsers } from "../../../utils/serializers";

// ─── Admin Dashboard ───────────────────────────────────────────────────────────

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};

    const cacheKey = CacheKeys.getDashboardKey(actor.id, departmentId);
    const cachedData = appCache.get(cacheKey);

    if (cachedData) {
      return (res as any).success(cachedData);
    }

    const userRepo = AppDataSource.getRepository(User);
    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);
    const auditRepo = AppDataSource.getRepository(AuditLog);

    // Filter strictly for non-admins if scope is DEPARTMENT
    const isGlobalAdmin = actor.role === UserRole.SUPERADMIN || actor.role === UserRole.ADMIN;
    const deptId = !isGlobalAdmin && scope === PermissionScope.DEPARTMENT ? departmentId : undefined;

    // 1. Basic Counts
    const staffCountQuery = userRepo.createQueryBuilder("u").where("u.isActive = true");
    if (deptId) {
      // Note: mapping through UserDepartmentRole for staff count in a specific dept
      staffCountQuery
        .innerJoin("u.departmentRoles", "udr")
        .andWhere("udr.departmentId = :deptId", { deptId });
    }

    const shipmentQuery = shipmentRepo.createQueryBuilder("s");
    if (deptId) {
      shipmentQuery.where("s.departmentId = :deptId", { deptId });
    }

    const [totalStaff, totalShipments] = await Promise.all([
      staffCountQuery.getCount(),
      shipmentQuery.getCount(),
    ]);

    // 2. Shipment stats
    const statusCounts = await shipmentQuery
      .select("s.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("s.status")
      .getRawMany();

    const typeCounts = await shipmentQuery
      .select("s.type", "type")
      .addSelect("COUNT(*)", "count")
      .groupBy("s.type")
      .getRawMany();

    const statusMap: Record<string, number> = {
      [ShipmentStatus.PENDING]: 0,
      [ShipmentStatus.IN_TRANSIT]: 0,
      [ShipmentStatus.CUSTOMS]: 0,
      [ShipmentStatus.DELIVERED]: 0,
      [ShipmentStatus.ON_HOLD]: 0,
      [ShipmentStatus.CANCELLED]: 0,
    };
    for (const row of statusCounts) {
      if (statusMap[row.status] !== undefined) statusMap[row.status] = Number(row.count);
    }

    let exportsCount = 0, importsCount = 0;
    for (const row of typeCounts) {
      if (row.type === "export") exportsCount = Number(row.count);
      if (row.type === "import") importsCount = Number(row.count);
    }

    // 3. Revenue
    const paymentQuery = paymentRepo.createQueryBuilder("p").select("COALESCE(SUM(p.amount), 0)", "totalRevenue");
    paymentQuery.where("p.status = 'SUCCESS'");
    if (deptId) {
        // Find payments linked to shipments within this department
        paymentQuery.innerJoin("p.shipment", "s").andWhere("s.departmentId = :deptId", { deptId });
    }
    const revenueResult = await paymentQuery.getRawOne();

    // 4. Recent Activities (last 15 audit log entries)
    const auditQuery = auditRepo.createQueryBuilder("a").leftJoinAndSelect("a.performer", "u");
    if (deptId) {
      auditQuery.where("a.departmentId = :deptId", { deptId });
    }
    const recentActivities = await auditQuery.orderBy("a.performedAt", "DESC").take(15).getMany();

    // 5. Recent Shipments (last 15)
    if (deptId) shipmentQuery.leftJoinAndSelect("s.assignedOfficer", "officer").leftJoinAndSelect("s.department", "dept");
    else shipmentQuery.leftJoinAndSelect("s.assignedOfficer", "officer").leftJoinAndSelect("s.department", "dept");
    
    const recentShipments = await shipmentQuery.orderBy("s.createdAt", "DESC").take(15).getMany();

    const dashboardData = {
      kpis: {
        totalShipments,
        exports: exportsCount,
        imports: importsCount,
        pending: statusMap[ShipmentStatus.PENDING],
        inTransit: statusMap[ShipmentStatus.IN_TRANSIT],
        customs: statusMap[ShipmentStatus.CUSTOMS],
        delivered: statusMap[ShipmentStatus.DELIVERED],
        onHold: statusMap[ShipmentStatus.ON_HOLD],
        cancelled: statusMap[ShipmentStatus.CANCELLED],
        activeStaff: totalStaff,
        totalRevenue: Number(revenueResult.totalRevenue),
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        performedBy: a.performer ? { id: a.performer.id, name: `${a.performer.firstName} ${a.performer.lastName}` } : null,
        timestamp: a.performedAt,
        details: a.actionDetails,
      })),
      recentShipments,
    };

    appCache.set(cacheKey, dashboardData);

    return (res as any).success(dashboardData);
  } catch (err) {
    console.error("[AdminController.getDashboardStats]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}


// ─── Admin: Monthly Report ─────────────────────────────────────────────────────

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

    const [totalBookings, newStaff, deliveredCount] = await Promise.all([
      // Total shipments this month
      shipmentRepo
        .createQueryBuilder("s")
        .where("s.createdAt BETWEEN :start AND :end", {
          start: startDate,
          end: endDate,
        })
        .getCount(),
      // New staff this month
      userRepo
        .createQueryBuilder("u")
        .where("u.createdAt BETWEEN :start AND :end", {
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
    const reportReady =
      totalBookings === 0
        ? 0
        : Math.round((deliveredCount / totalBookings) * 100);

    return (res as any).success({
      year,
      month,
      totalBookings,
      newStaff,
      totalRevenue,
      deliveredCount,
      reportReady,
    });
  } catch (err) {
    console.error("[AdminController.getMonthlyReport]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: List all users (staff) ────────────────────────────────────────────

export async function listAllUsers(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = (req.query.search as string) || "";
    const role = req.query.role as UserRole | undefined;

    const repo = AppDataSource.getRepository(User);
    const qb = repo.createQueryBuilder("u");

    if (search) {
      qb.where(
        "(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s)",
        { s: `%${search}%` },
      );
    }
    if (role && Object.values(UserRole).includes(role)) {
      qb.andWhere("u.role = :role", { role });
    }

    qb.orderBy("u.createdAt", "DESC").skip(skip).take(limit);
    const [users, total] = await qb.getManyAndCount();

    return (res as any).success(serializeUsers(users), undefined, paginate(total, page, limit));
  } catch (err) {
    console.error("[AdminController.listAllUsers]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

/**
 * GET Staff Performance Analytics
 * Returns a list of staff members with their shipment handling statistics.
 */
export async function getStaffPerformance(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const { scope, departmentId } = (req as any).permissionScope || {};

    const cacheKey = `staff_performance_${departmentId || "global"}_${actor.id}`;
    const cached = appCache.get(cacheKey);
    if (cached) return (res as any).success(cached);

    const userRepo = AppDataSource.getRepository(User);
    
    const qb = userRepo.createQueryBuilder("u")
      .leftJoin("u.assignedShipments", "s")
      .select([
        "u.id as id",
        "u.firstName as firstName",
        "u.lastName as lastName",
        "u.email as email",
        "COUNT(s.id) as totalAssigned",
        "COUNT(CASE WHEN s.status = 'delivered' THEN 1 END) as deliveredCount",
        "COUNT(CASE WHEN s.status = 'in_transit' THEN 1 END) as activeCount"
      ])
      .where("u.role IN (:...roles)", { roles: [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPERADMIN] });

    if (scope === PermissionScope.DEPARTMENT && departmentId) {
      qb.innerJoin("u.departmentRoles", "udr").andWhere("udr.departmentId = :deptId", { deptId: departmentId });
    }

    const performance = await qb.groupBy("u.id").orderBy("totalAssigned", "DESC").getRawMany();

    // Map and calculate success rate
    const data = performance.map(p => ({
      id: p.id,
      name: `${p.firstname} ${p.lastname}`,
      email: p.email,
      totalAssigned: Number(p.totalassigned),
      deliveredCount: Number(p.deliveredcount),
      activeCount: Number(p.activecount),
      successRate: Number(p.totalassigned) > 0 
        ? Math.round((Number(p.deliveredcount) / Number(p.totalassigned)) * 100) 
        : 0
    }));

    appCache.set(cacheKey, data);

    return (res as any).success(data);
  } catch (err) {
    console.error("[AdminController.getStaffPerformance]", err);
    return res.status(500).json({ status: "error", message: "Failed to fetch performance stats." });
  }
}

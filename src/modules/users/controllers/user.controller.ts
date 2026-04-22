import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../../../../database/data-source";
import { User, UserRole } from "../entities/User";
import { UserDepartmentRole } from "../entities/UserDepartmentRole";
import { Department } from "../../departments/entities/Department";
import { Role } from "../../roles/entities/Role";
import { Shipment } from "../../shipments/entities/Shipment";
import { Payment } from "../../financial/entities/Payment";
import { AuditLog } from "../../audit/entities/AuditLog";
import { parsePagination, paginate } from "../../../utils/helpers";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { serializeUser } from "../../../utils/serializers";
import crypto from "crypto";

const userRepo = () => AppDataSource.getRepository(User);

// ─── Admin: Create a new staff/admin account ──────────────────────────────────

export async function createAdmin(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "All fields are required." });
    }

    const repo = userRepo();
    const exists = await repo.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (exists) {
      return res
        .status(409)
        .json({ status: "error", message: "Email already registered." });
    }

    const hashed = await bcrypt.hash(password, 12);
    const admin = repo.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role: UserRole.ADMIN,
    });

    await repo.save(admin);

    createAuditLog({
      entityType: "User",
      entityId: admin.id,
      action: AuditAction.CREATE,
      actionDetails: { email: admin.email, role: admin.role },
      performedBy: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).status(201).success(serializeUser(admin), "Admin created successfully.");
  } catch (err) {
    console.error("[UserController.createAdmin]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── SuperAdmin: Create staff member assigned to a department ─────────────────

export async function createStaff(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const {
      firstName, lastName, email, phoneNumber,
      departmentId, roleId,
    } = req.body;

    if (!firstName || !lastName || !email || !departmentId || !roleId) {
      return res.status(400).json({
        status: "error",
        message: "firstName, lastName, email, departmentId and roleId are required.",
      });
    }

    const repo = userRepo();

    const [exists, dept, role] = await Promise.all([
      repo.findOne({ where: { email: email.toLowerCase().trim() } }),
      AppDataSource.getRepository(Department).findOne({ where: { id: departmentId } }),
      AppDataSource.getRepository(Role).findOne({ where: { id: roleId } }),
    ]);

    if (exists) {
      return res.status(409).json({ status: "error", message: "Email already registered." });
    }
    if (!dept) {
      return res.status(404).json({ status: "error", message: "Department not found." });
    }
    if (!role) {
      return res.status(404).json({ status: "error", message: "Role not found." });
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashed = await bcrypt.hash(tempPassword, 12);

    const user = repo.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      phoneNumber: phoneNumber?.trim(),
      role: UserRole.STAFF, // base system role; departmental role via UDR
    });

    await repo.save(user);

    // Assign to department with role
    const udr = AppDataSource.getRepository(UserDepartmentRole).create({
      userId: user.id,
      departmentId: dept.id,
      roleId: role.id,
    });
    await AppDataSource.getRepository(UserDepartmentRole).save(udr);

    // Update department staff count
    await AppDataSource.getRepository(Department).increment(
      { id: dept.id },
      "totalStaff",
      1,
    );

    createAuditLog({
      entityType: "User",
      entityId: user.id,
      action: AuditAction.CREATE,
      actionDetails: { email: user.email, departmentId, roleId, createdBy: actor.id },
      performedBy: actor.id,
      departmentId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).status(201).success(
      {
        ...serializeUser(user),
        tempPassword,
        department: dept.name,
        role: role.name,
      },
      "Staff member created successfully. A temporary password has been set."
    );
  } catch (err) {
    console.error("[UserController.createStaff]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Upgrade an existing user to admin ────────────────────────────────

export async function upgradeToAdmin(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const repo = userRepo();
    const target = await repo.findOne({ where: { id: userId } });

    if (!target) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found." });
    }
    if (target.role === UserRole.SUPERADMIN) {
      return res
        .status(400)
        .json({ status: "error", message: "Cannot change superadmin role." });
    }

    const previousRole = target.role;
    target.role = UserRole.ADMIN;
    await repo.save(target);

    createAuditLog({
      entityType: "User",
      entityId: target.id,
      action: AuditAction.UPDATE,
      actionDetails: { field: "role", before: previousRole, after: UserRole.ADMIN },
      performedBy: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(serializeUser(target), "User upgraded to admin.");
  } catch (err) {
    console.error("[UserController.upgradeToAdmin]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Downgrade admin back to staff ───────────────────────────────────

export async function downgradeToStaff(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const repo = userRepo();
    const target = await repo.findOne({ where: { id: userId } });

    if (!target) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found." });
    }
    if (target.role === UserRole.SUPERADMIN) {
      return res
        .status(400)
        .json({ status: "error", message: "Cannot change superadmin role." });
    }

    const previousRole = target.role;
    target.role = UserRole.STAFF;
    await repo.save(target);

    createAuditLog({
      entityType: "User",
      entityId: target.id,
      action: AuditAction.UPDATE,
      actionDetails: { field: "role", before: previousRole, after: UserRole.STAFF },
      performedBy: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(serializeUser(target), "Admin downgraded to staff member.");
  } catch (err) {
    console.error("[UserController.downgradeToStaff]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Deactivate a user ─────────────────────────────────────────────────

export async function deactivateUser(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const { reason } = req.body;
    const actor = (req as any).user as User;

    const repo = userRepo();
    const target = await repo.findOne({ where: { id: userId } });

    if (!target) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }
    if (target.role === UserRole.SUPERADMIN) {
      return res.status(403).json({ status: "error", message: "Cannot deactivate a superadmin." });
    }

    target.isActive = false;
    // Invalidate any open sessions
    target.refreshToken = undefined;
    target.refreshTokenExpiresAt = undefined;
    await repo.save(target);

    createAuditLog({
      entityType: "User",
      entityId: target.id,
      action: AuditAction.UPDATE,
      actionDetails: { field: "isActive", before: true, after: false, reason },
      performedBy: actor.id,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "User deactivated.");
  } catch (err) {
    console.error("[UserController.deactivateUser]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Reactivate a user ─────────────────────────────────────────────────

export async function reactivateUser(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const actor = (req as any).user as User;

    const repo = userRepo();
    const target = await repo.findOne({ where: { id: userId } });

    if (!target) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }

    target.isActive = true;
    await repo.save(target);

    createAuditLog({
      entityType: "User",
      entityId: target.id,
      action: AuditAction.UPDATE,
      actionDetails: { field: "isActive", before: false, after: true },
      performedBy: actor.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "User reactivated.");
  } catch (err) {
    console.error("[UserController.reactivateUser]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Reset a user's password ──────────────────────────────────────────

export async function resetUserPassword(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const actor = (req as any).user as User;

    const repo = userRepo();
    const target = await repo.findOne({ where: { id: userId } });

    if (!target) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }

    const tempPassword = crypto.randomBytes(8).toString("hex");
    target.password = await bcrypt.hash(tempPassword, 12);
    target.refreshToken = undefined;
    target.refreshTokenExpiresAt = undefined;
    await repo.save(target);

    createAuditLog({
      entityType: "User",
      entityId: target.id,
      action: AuditAction.PASSWORD_RESET,
      actionDetails: { resetBy: actor.id },
      performedBy: actor.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success({ tempPassword }, "Password reset successfully.");
  } catch (err) {
    console.error("[UserController.resetUserPassword]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: List all users ────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = (req.query.search as string) || "";
    const role = req.query.role as UserRole | undefined;

    const repo = userRepo();
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

    return (res as any).success(users.map(serializeUser), undefined, paginate(total, page, limit));
  } catch (err) {
    console.error("[UserController.listUsers]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Get staff profile ─────────────────────────────────────────────────

export async function getUser(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const user = await userRepo().findOne({
      where: { id: userId },
      relations: ["departmentRoles", "departmentRoles.department", "departmentRoles.role"],
    });
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found." });
    }

    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);
    const auditRepo = AppDataSource.getRepository(AuditLog);

    const [assignedShipments, totalSpentResult, recentActivity] = await Promise.all([
      // Active shipments assigned to this staff member
      shipmentRepo.count({ where: { assignedOfficerId: userId } }),
      // Total revenue processed
      paymentRepo
        .createQueryBuilder("p")
        .select("SUM(p.amount)", "total")
        .where("p.userId = :userId AND p.status = 'SUCCESS'", { userId })
        .getRawOne(),
      // Last 20 actions by this user
      auditRepo
        .createQueryBuilder("a")
        .where("a.performedBy = :uid", { uid: userId })
        .orderBy("a.performedAt", "DESC")
        .take(20)
        .getMany(),
    ]);

    return (res as any).success({
      ...serializeUser(user),
      stats: {
        assignedShipments,
        totalProcessed: Number(totalSpentResult?.total || 0),
      },
      departments: user.departmentRoles.map((udr) => ({
        department: udr.department,
        role: udr.role,
        since: udr.createdAt,
      })),
      recentActivity,
    });
  } catch (err) {
    console.error("[UserController.getUser]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Staff: Get own dashboard summary ─────────────────────────────────────────

export async function myDashboard(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);

    const [assignedShipments, totalPaid] = await Promise.all([
      shipmentRepo.count({ where: { assignedOfficerId: user.id } }),
      paymentRepo
        .createQueryBuilder("p")
        .select("COALESCE(SUM(p.amount), 0)", "total")
        .where("p.userId = :id AND p.status = 'SUCCESS'", { id: user.id })
        .getRawOne(),
    ]);

    return (res as any).success({
      user: serializeUser(user),
      assignedShipments,
      totalProcessed: Number(totalPaid?.total || 0),
    });
  } catch (err) {
    console.error("[UserController.myDashboard]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

import { NotificationPreference } from "../entities/NotificationPreference";

// ... (existing exports)

/**
 * GET own notification preferences
 */
export async function getNotificationPreferences(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const prefRepo = AppDataSource.getRepository(NotificationPreference);
    
    let pref = await prefRepo.findOneBy({ userId: user.id });
    if (!pref) {
      pref = prefRepo.create({ userId: user.id });
      await prefRepo.save(pref);
    }

    return (res as any).success(pref);
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Failed to fetch preferences." });
  }
}

/**
 * PATCH own notification preferences
 */
export async function updateNotificationPreferences(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const prefRepo = AppDataSource.getRepository(NotificationPreference);
    
    let pref = await prefRepo.findOneBy({ userId: user.id });
    if (!pref) {
      pref = prefRepo.create({ userId: user.id });
    }

    const {
      emailShipmentStatus, emailAssignments, emailFinancial,
      inAppShipmentStatus, inAppAssignments, inAppFinancial,
      quietHoursEnabled, quietHoursStart, quietHoursEnd
    } = req.body;

    if (emailShipmentStatus !== undefined) pref.emailShipmentStatus = !!emailShipmentStatus;
    if (emailAssignments !== undefined) pref.emailAssignments = !!emailAssignments;
    if (emailFinancial !== undefined) pref.emailFinancial = !!emailFinancial;
    if (inAppShipmentStatus !== undefined) pref.inAppShipmentStatus = !!inAppShipmentStatus;
    if (inAppAssignments !== undefined) pref.inAppAssignments = !!inAppAssignments;
    if (inAppFinancial !== undefined) pref.inAppFinancial = !!inAppFinancial;
    
    if (quietHoursEnabled !== undefined) pref.quietHoursEnabled = !!quietHoursEnabled;
    if (quietHoursStart !== undefined) pref.quietHoursStart = quietHoursStart;
    if (quietHoursEnd !== undefined) pref.quietHoursEnd = quietHoursEnd;

    await prefRepo.save(pref);

    return (res as any).success(pref);
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Failed to update preferences." });
  }
}


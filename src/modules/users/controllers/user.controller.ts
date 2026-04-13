import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../../../../database/data-source";
import { User, UserRole } from "../entities/User";
import { Shipment } from "../../shipments/entities/Shipment";
import { Payment } from "../../financial/entities/Payment";
import { parsePagination, paginate } from "../../../utils/helpers";
import { createAuditLog } from "../../audit/services/audit.service";

const userRepo = () => AppDataSource.getRepository(User);

// ─── Admin: Create a new admin account ───────────────────────────────────────

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

    await createAuditLog({
      action: "ADMIN_CREATED",
      resource: "User",
      resourceId: admin.id,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      status: "success",
      message: "Admin created successfully.",
      data: sanitize(admin),
    });
  } catch (err) {
    console.error("[UserController.createAdmin]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
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

    target.role = UserRole.ADMIN;
    await repo.save(target);
    await repo.save(target);

    await createAuditLog({
      action: "ROLE_UPGRADED_TO_ADMIN",
      resource: "User",
      resourceId: target.id,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      status: "success",
      message: "User upgraded to admin.",
      data: sanitize(target),
    });
  } catch (err) {
    console.error("[UserController.upgradeToAdmin]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Downgrade admin back to customer ─────────────────────────────────

export async function downgradeToCustomer(req: Request, res: Response) {
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

    target.role = UserRole.CUSTOMER;
    await repo.save(target);

    await createAuditLog({
      action: "ROLE_DOWNGRADED_TO_CUSTOMER",
      resource: "User",
      resourceId: target.id,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      status: "success",
      message: "Admin downgraded to customer.",
      data: sanitize(target),
    });
  } catch (err) {
    console.error("[UserController.downgradeToCustomer]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
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

    return res.status(200).json({
      status: "success",
      data: users.map(sanitize),
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[UserController.listUsers]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Get a single user with booking count ─────────────────────────────

export async function getUser(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "User not found." });

    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);

    // Get statistics
    const [totalBookings, totalSpentResult] = await Promise.all([
      shipmentRepo.count({ where: { clientEmail: user.email } }),
      paymentRepo
        .createQueryBuilder("p")
        .select("SUM(p.amount)", "total")
        .where("p.userId = :userId AND p.status = 'SUCCESS'", { userId })
        .getRawOne(),
    ]);

    // Get recent activities
    const [recentShipments, recentPayments] = await Promise.all([
      shipmentRepo.find({
        where: { clientEmail: user.email },
        order: { createdAt: "DESC" },
        take: 10,
      }),
      paymentRepo.find({
        where: { userId: userId },
        order: { createdAt: "DESC" },
        take: 10,
      }),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        ...sanitize(user),
        stats: {
          totalBookings,
          totalSpent: Number(totalSpentResult?.total || 0),
          outstandingBalance: Number(user.outstandingBalance),
        },
        recentShipments,
        recentPayments,
      },
    });
  } catch (err) {
    console.error("[UserController.getUser]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Customer: Get own dashboard summary ─────────────────────────────────────

export async function myDashboard(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const paymentRepo = AppDataSource.getRepository(Payment);

    const totalBookings = await shipmentRepo.count({
      where: { clientEmail: user.email },
    });
    const totalPaid = await paymentRepo
      .createQueryBuilder("p")
      .select("COALESCE(SUM(p.amount), 0)", "total")
      .where("p.userId = :id AND p.status = 'SUCCESS'", { id: user.id })
      .getRawOne();

    return res.status(200).json({
      status: "success",
      data: {
        user: sanitize(user),
        totalBookings,
        totalPaid: Number(totalPaid?.total || 0),
        outstandingBalance: Number(user.outstandingBalance),
      },
    });
  } catch (err) {
    console.error("[UserController.myDashboard]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function sanitize(user: User) {
  const { password, ...rest } = user as any;
  return rest;
}

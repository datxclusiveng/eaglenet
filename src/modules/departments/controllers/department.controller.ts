import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Department, DepartmentStatus } from "../entities/Department";
import { User } from "../../users/entities/User";
import { UserDepartmentRole } from "../../users/entities/UserDepartmentRole";
import { Shipment, ShipmentStatus } from "../../shipments/entities/Shipment";
import { Role } from "../../roles/entities/Role";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { parsePagination, paginate } from "../../../utils/helpers";

const repo = () => AppDataSource.getRepository(Department);

// ─── List all departments ──────────────────────────────────────────────────────
export async function listDepartments(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as DepartmentStatus | undefined;

    const qb = repo()
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.supervisor", "sup")
      .leftJoinAndSelect("d.createdBy", "creator")
      .orderBy("d.name", "ASC")
      .skip(skip)
      .take(limit);

    if (status) {
      qb.where("d.status = :status", { status });
    }

    const [departments, total] = await qb.getManyAndCount();

    // Attach active shipment counts
    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const withStats = await Promise.all(
      departments.map(async (dept) => {
        const activeShipments = await shipmentRepo.count({
          where: {
            departmentId: dept.id,
            status: ShipmentStatus.IN_TRANSIT,
          },
        });
        return {
          ...dept,
          supervisor: dept.supervisor
            ? { id: dept.supervisor.id, name: `${dept.supervisor.firstName} ${dept.supervisor.lastName}`, email: dept.supervisor.email }
            : null,
          createdBy: dept.createdBy
            ? { id: dept.createdBy.id, name: `${dept.createdBy.firstName} ${dept.createdBy.lastName}` }
            : null,
          activeShipments,
        };
      }),
    );

    return res.status(200).json({
      status: "success",
      data: withStats,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[DepartmentController.list]", err);
    return res.status(500).json({ status: "error", message: "Error fetching departments." });
  }
}

// ─── Get single department with full stats ─────────────────────────────────────
export async function getDepartment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const dept = await repo().findOne({
      where: { id },
      relations: ["supervisor", "createdBy"],
    });
    if (!dept) {
      return res.status(404).json({ status: "error", message: "Department not found." });
    }

    const [shipmentRepo, udrRepo] = [
      AppDataSource.getRepository(Shipment),
      AppDataSource.getRepository(UserDepartmentRole),
    ];

    const [totalShipments, pendingShipments, activeShipments, staffCount] =
      await Promise.all([
        shipmentRepo.count({ where: { departmentId: id } }),
        shipmentRepo.count({ where: { departmentId: id, status: ShipmentStatus.PENDING } }),
        shipmentRepo.count({ where: { departmentId: id, status: ShipmentStatus.IN_TRANSIT } }),
        udrRepo.count({ where: { departmentId: id } }),
      ]);

    return res.status(200).json({
      status: "success",
      data: {
        ...dept,
        supervisor: dept.supervisor
          ? { id: dept.supervisor.id, name: `${dept.supervisor.firstName} ${dept.supervisor.lastName}`, email: dept.supervisor.email }
          : null,
        stats: {
          totalShipments,
          pendingShipments,
          activeShipments,
          totalStaff: staffCount,
        },
      },
    });
  } catch (err) {
    console.error("[DepartmentController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Create department ─────────────────────────────────────────────────────────
export async function createDepartment(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const { name, email, supervisorId, metadata } = req.body;

    if (!name) {
      return res.status(400).json({ status: "error", message: "Department name is required." });
    }

    // Check uniqueness
    const [nameExists, emailExists] = await Promise.all([
      repo().findOneBy({ name }),
      email ? repo().findOneBy({ email }) : Promise.resolve(null),
    ]);

    if (nameExists) {
      return res.status(409).json({ status: "error", message: "A department with that name already exists." });
    }
    if (emailExists) {
      return res.status(409).json({ status: "error", message: "A department with that email already exists." });
    }

    // Validate supervisor if provided
    if (supervisorId) {
      const supervisor = await AppDataSource.getRepository(User).findOneBy({ id: supervisorId });
      if (!supervisor) {
        return res.status(404).json({ status: "error", message: "Supervisor user not found." });
      }
    }

    const dept = repo().create({
      name: name.trim(),
      email: email?.toLowerCase().trim(),
      supervisorId: supervisorId || null,
      createdById: actor.id,
      status: DepartmentStatus.ACTIVE,
      metadata: metadata || {},
    });

    await repo().save(dept);

    createAuditLog({
      entityType: "Department",
      entityId: dept.id,
      action: AuditAction.CREATE,
      actionDetails: { name: dept.name, email: dept.email, supervisorId },
      performedBy: actor.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({ status: "success", data: dept });
  } catch (err) {
    console.error("[DepartmentController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Update department ─────────────────────────────────────────────────────────
export async function updateDepartment(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const id = req.params.id as string;
    const { name, email, supervisorId, status, metadata } = req.body;

    const dept = await repo().findOneBy({ id });
    if (!dept) {
      return res.status(404).json({ status: "error", message: "Department not found." });
    }

    const before = { name: dept.name, email: dept.email, supervisorId: dept.supervisorId, status: dept.status };

    if (name && name !== dept.name) {
      const exists = await repo().findOneBy({ name });
      if (exists) {
        return res.status(409).json({ status: "error", message: "Department name already taken." });
      }
      dept.name = name.trim();
    }
    if (email && email !== dept.email) {
      const exists = await repo().findOneBy({ email });
      if (exists) {
        return res.status(409).json({ status: "error", message: "Department email already in use." });
      }
      dept.email = email.toLowerCase().trim();
    }
    if (supervisorId !== undefined) {
      if (supervisorId) {
        const supervisor = await AppDataSource.getRepository(User).findOneBy({ id: supervisorId });
        if (!supervisor) {
          return res.status(404).json({ status: "error", message: "Supervisor user not found." });
        }
      }
      dept.supervisorId = supervisorId || undefined;
    }
    if (status && Object.values(DepartmentStatus).includes(status)) {
      dept.status = status;
    }
    if (metadata) {
      dept.metadata = { ...dept.metadata, ...metadata };
    }

    await repo().save(dept);

    createAuditLog({
      entityType: "Department",
      entityId: dept.id,
      action: AuditAction.UPDATE,
      actionDetails: { before, after: { name: dept.name, email: dept.email, supervisorId: dept.supervisorId, status: dept.status } },
      performedBy: actor.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", data: dept });
  } catch (err) {
    console.error("[DepartmentController.update]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Delete (soft) department ──────────────────────────────────────────────────
export async function deleteDepartment(req: Request, res: Response) {
  try {
    const actor = (req as any).user as User;
    const id = req.params.id as string;

    const dept = await repo().findOneBy({ id });
    if (!dept) {
      return res.status(404).json({ status: "error", message: "Department not found." });
    }

    // Check if there are active shipments — do not allow deletion if so
    const activeShipments = await AppDataSource.getRepository(Shipment).count({
      where: { departmentId: id, status: ShipmentStatus.IN_TRANSIT },
    });
    if (activeShipments > 0) {
      return res.status(409).json({
        status: "error",
        message: `Cannot delete department with ${activeShipments} active in-transit shipment(s). Reassign them first.`,
      });
    }

    await repo().softDelete(id);

    createAuditLog({
      entityType: "Department",
      entityId: id,
      action: AuditAction.DELETE,
      actionDetails: { name: dept.name },
      performedBy: actor.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ status: "success", message: "Department deleted." });
  } catch (err) {
    console.error("[DepartmentController.delete]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── List staff in a department ────────────────────────────────────────────────
export async function getDepartmentStaff(req: Request, res: Response) {
  try {
    const departmentId = req.params.id as string;
    const { page, limit, skip } = parsePagination(req.query);

    const dept = await repo().findOneBy({ id: departmentId });
    if (!dept) {
      return res.status(404).json({ status: "error", message: "Department not found." });
    }

    const udrRepo = AppDataSource.getRepository(UserDepartmentRole);
    const [udrs, total] = await udrRepo
      .createQueryBuilder("udr")
      .leftJoinAndSelect("udr.user", "u")
      .leftJoinAndSelect("udr.role", "r")
      .where("udr.departmentId = :departmentId", { departmentId })
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const staff = await Promise.all(
      udrs.map(async (udr) => {
        const activeShipments = await shipmentRepo.count({
          where: { assignedOfficerId: udr.userId },
        });
        const { password, refreshToken, refreshTokenExpiresAt, ...safeUser } = udr.user as any;
        return {
          ...safeUser,
          role: udr.role,
          assignedAt: udr.createdAt,
          activeShipments,
        };
      }),
    );

    return res.status(200).json({
      status: "success",
      data: staff,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[DepartmentController.getStaff]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── List available roles ──────────────────────────────────────────────────────
export async function listRoles(_req: Request, res: Response) {
  try {
    const roles = await AppDataSource.getRepository(Role).find({
      order: { name: "ASC" },
      relations: ["permissions"],
    });
    return res.status(200).json({ status: "success", data: roles });
  } catch (err) {
    console.error("[DepartmentController.listRoles]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

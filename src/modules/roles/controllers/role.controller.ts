import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Role } from "../entities/Role";
import { Permission } from "../../permissions/entities/Permission";
import { In } from "typeorm";

const repo = () => AppDataSource.getRepository(Role);

export async function listRoles(_req: Request, res: Response) {
  try {
    const roles = await repo().find({
      relations: ["permissions"],
      order: { name: "ASC" },
    });
    return res.status(200).json({ status: "success", data: roles });
  } catch (err) {
    console.error("[RoleController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function createRole(req: Request, res: Response) {
  try {
    const { name, permissionIds } = req.body;

    const existing = await repo().findOne({ where: { name } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "Role already exists." });
    }

    const permissions = await AppDataSource.getRepository(Permission).findBy({
      id: In(permissionIds || []),
    });

    const role = repo().create({
      name,
      permissions,
    });

    await repo().save(role);
    return res.status(201).json({ status: "success", data: role });
  } catch (err) {
    console.error("[RoleController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function updateRolePermissions(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { permissionIds } = req.body;

    const role = await repo().findOne({ where: { id } });
    if (!role) {
      return res.status(404).json({ status: "error", message: "Role not found." });
    }

    const permissions = await AppDataSource.getRepository(Permission).findBy({
      id: In(permissionIds || []),
    });

    role.permissions = permissions;
    await repo().save(role);

    return res.status(200).json({ status: "success", data: role });
  } catch (err) {
    console.error("[RoleController.update]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

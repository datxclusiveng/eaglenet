import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Permission } from "../entities/Permission";

const repo = () => AppDataSource.getRepository(Permission);

export async function listPermissions(_req: Request, res: Response) {
  try {
    const permissions = await repo().find({
      order: { resource: "ASC", action: "ASC" },
    });
    return res.status(200).json({ status: "success", data: permissions });
  } catch (err) {
    console.error("[PermissionController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function createPermission(req: Request, res: Response) {
  try {
    const { resource, action, scope, conditions } = req.body;
    
    const permission = repo().create({
      resource,
      action,
      scope,
      conditions: conditions || {},
    });

    await repo().save(permission);
    return res.status(201).json({ status: "success", data: permission });
  } catch (err) {
    console.error("[PermissionController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

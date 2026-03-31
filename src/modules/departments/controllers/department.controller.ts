import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Department } from "../entities/Department";

const repo = () => AppDataSource.getRepository(Department);

// ─── Admin: List all departments ──────────────────────────────────────────────
export async function listDepartments(_req: Request, res: Response) {
  try {
    const departments = await repo().find({
      order: { name: "ASC" },
    });
    return res.status(200).json({ status: "success", data: departments });
  } catch (err) {
    console.error("[DepartmentController.list]", err);
    return res.status(500).json({ status: "error", message: "Error fetching departments." });
  }
}

// ─── Admin: Get single department details ─────────────────────────────────────
export async function getDepartment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const department = await repo().findOneBy({ id });
    if (!department)
      return res.status(404).json({ status: "error", message: "Department not found." });

    return res.status(200).json({ status: "success", data: department });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Create department ──────────────────────────────────────────────────
export async function createDepartment(req: Request, res: Response) {
  try {
    const { name, metadata } = req.body;
    if (!name)
      return res.status(400).json({ status: "error", message: "Name is required." });

    const exists = await repo().findOneBy({ name });
    if (exists)
      return res.status(409).json({ status: "error", message: "Department name exists." });

    const dept = repo().create({
      name: name.trim(),
      metadata: metadata || {},
    });

    await repo().save(dept);
    return res.status(201).json({ status: "success", data: dept });
  } catch (err) {
    console.error("[DepartmentController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Update department ──────────────────────────────────────────────────
export async function updateDepartment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, metadata } = req.body;

    const dept = await repo().findOneBy({ id });
    if (!dept)
      return res.status(404).json({ status: "error", message: "Department not found." });

    if (name) dept.name = name.trim();
    if (metadata) dept.metadata = { ...dept.metadata, ...metadata };

    await repo().save(dept);
    return res.status(200).json({ status: "success", data: dept });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Delete department ──────────────────────────────────────────────────
export async function deleteDepartment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await repo().delete(id);
    return res.status(200).json({ status: "success", message: "Department deleted." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

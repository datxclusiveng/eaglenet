import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Service } from "../entities/Service";

const repo = () => AppDataSource.getRepository(Service);

export async function listServices(_req: Request, res: Response) {
  try {
    const services = await repo().find({ order: { serviceName: "ASC" } });
    return res.status(200).json({ status: "success", data: services });
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

export async function createService(req: Request, res: Response) {
  try {
    const { serviceName } = req.body;
    if (!serviceName)
      return res
        .status(400)
        .json({ status: "error", message: "Service name is required." });

    const service = repo().create({ serviceName });
    await repo().save(service);

    return res.status(201).json({ status: "success", data: service });
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

export async function updateService(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { serviceName } = req.body;

    const service = await repo().findOneBy({ id });
    if (!service)
      return res
        .status(404)
        .json({ status: "error", message: "Service not found." });

    if (serviceName) service.serviceName = serviceName;
    await repo().save(service);

    return res.status(200).json({ status: "success", data: service });
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

export async function deleteService(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await repo().delete(id);
    return res
      .status(200)
      .json({ status: "success", message: "Service deleted." });
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

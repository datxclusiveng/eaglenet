import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { Customer } from "../entities/Customer";
import { Shipment } from "../../shipments/entities/Shipment";
import { paginate, parsePagination } from "../../../utils/helpers";
import { ILike } from "typeorm";

const repo = () => AppDataSource.getRepository(Customer);

/**
 * List all customers (Paginated & Searchable)
 * GET /api/customers?search=...&page=1&limit=10
 */
export async function listCustomers(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search as string;

    const [rows, total] = await repo().findAndCount({
      where: search ? [
        { fullName: ILike(`%${search}%`) },
        { email: ILike(`%${search}%`) },
        { phoneNumber: ILike(`%${search}%`) }
      ] : {},
      skip,
      take: limit,
      order: { createdAt: "DESC" }
    });

    return res.status(200).json({
      status: "success",
      data: rows,
      meta: paginate(total, page, limit)
    });
  } catch (err) {
    console.error("[CustomerController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

/**
 * Create a new customer
 * POST /api/customers
 */
export async function createCustomer(req: Request, res: Response) {
  try {
    const { fullName, email, phoneNumber } = req.body;

    const existing = await repo().findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "Customer with this email already exists." });
    }

    const customer = repo().create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim()
    });

    await repo().save(customer);

    return res.status(201).json({ status: "success", data: customer });
  } catch (err) {
    console.error("[CustomerController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

/**
 * Get all shipments linked to a customer via email
 * GET /api/customers/:id/shipments
 */
export async function getCustomerShipments(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const customer = await repo().findOneBy({ id });

    if (!customer) {
      return res.status(404).json({ status: "error", message: "Customer not found." });
    }

    // Find shipments where client_email matches customer email
    const shipmentRepo = AppDataSource.getRepository(Shipment);
    const shipments = await shipmentRepo.find({
      where: { clientEmail: customer.email },
      order: { createdAt: "DESC" },
      relations: ["department"]
    });

    return res.status(200).json({
      status: "success",
      data: shipments
    });
  } catch (err) {
    console.error("[CustomerController.shipments]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { TransactionNature, EntryType } from "../entities/CashbookEntry";
import { paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import {
  createCashbookEntry,
  listCashbookEntries,
  getCashbookEntryById,
  updateCashbookEntry,
  softDeleteCashbookEntry,
  listMyCashbookEntries,
} from "../services/cashbook.service";

export async function createCashbookEntryHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const body = req.body;

    const entry = await createCashbookEntry({
      date: body.date,
      natureOfTransaction: body.natureOfTransaction,
      entryType: body.entryType,
      amount: Number(body.amount),
      bankName: body.bankName,
      bankAccountId: body.bankAccountId,
      description: body.description,
      voucherId: body.voucherId,
      createdById: user.id,
    });

    return res.status(201).json({ status: "success", data: entry });
  } catch (err: any) {
    console.error("[CashbookController.create]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error creating cashbook entry." });
  }
}

export async function listCashbookEntriesHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const natureOfTransaction = req.query.natureOfTransaction as TransactionNature | undefined;
    const entryType = req.query.entryType as EntryType | undefined;
    const bankName = req.query.bankName as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const [rows, total] = await listCashbookEntries({
      skip,
      take: limit,
      natureOfTransaction,
      entryType,
      startDate,
      endDate,
      bankName,
    });

    const sanitized = rows.map((entry) => ({
      ...entry,
      createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
    }));

    return res.status(200).json({
      status: "success",
      data: sanitized,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[CashbookController.list]", err);
    return res.status(500).json({ status: "error", message: "Error listing cashbook entries." });
  }
}

export async function getCashbookEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const entry = await getCashbookEntryById(id);
    if (!entry) {
      return res.status(404).json({ status: "error", message: "Cashbook entry not found." });
    }
    return res.status(200).json({
      status: "success",
      data: {
        ...entry,
        createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
      },
    });
  } catch (err) {
    console.error("[CashbookController.get]", err);
    return res.status(500).json({ status: "error", message: "Error retrieving cashbook entry." });
  }
}

export async function updateCashbookEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const body = req.body;

    const data: any = {};
    if (body.date !== undefined) data.date = body.date;
    if (body.natureOfTransaction !== undefined) data.natureOfTransaction = body.natureOfTransaction;
    if (body.entryType !== undefined) data.entryType = body.entryType;
    if (body.amount !== undefined) data.amount = Number(body.amount);
    if (body.bankName !== undefined) data.bankName = body.bankName;
    if (body.bankAccountId !== undefined) data.bankAccountId = body.bankAccountId;
    if (body.description !== undefined) data.description = body.description;
    if (body.voucherId !== undefined) data.voucherId = body.voucherId;

    const entry = await updateCashbookEntry(id, data);
    return res.status(200).json({ status: "success", data: entry });
  } catch (err: any) {
    console.error("[CashbookController.update]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error updating cashbook entry." });
  }
}

export async function deleteCashbookEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await softDeleteCashbookEntry(id);
    return res.status(200).json({ status: "success", message: "Cashbook entry deleted." });
  } catch (err: any) {
    console.error("[CashbookController.delete]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error deleting cashbook entry." });
  }
}

export async function listMyCashbookHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const user = (req as any).user as User;
    const natureOfTransaction = req.query.natureOfTransaction as TransactionNature | undefined;
    const entryType = req.query.entryType as EntryType | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const [rows, total] = await listMyCashbookEntries({
      userId: user.id,
      skip,
      take: limit,
      natureOfTransaction,
      entryType,
      startDate,
      endDate,
    });

    const sanitized = rows.map((entry) => ({
      ...entry,
      createdBy: sanitizeUser(entry.createdBy),
    }));

    return res.status(200).json({
      status: "success",
      data: sanitized,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[CashbookController.listMy]", err);
    return res.status(500).json({ status: "error", message: "Error listing your cashbook entries." });
  }
}

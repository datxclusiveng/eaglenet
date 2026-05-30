import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { LedgerTransactionNature, LedgerEntryType } from "../entities/LedgerEntry";
import { paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import {
  createLedgerEntry,
  listLedgerEntries,
  getLedgerEntryById,
  updateLedgerEntry,
  softDeleteLedgerEntry,
  listMyLedgerEntries,
} from "../services/ledger.service";

export async function createLedgerEntryHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const body = req.body;

    const entry = await createLedgerEntry({
      date: body.date,
      description: body.description,
      amount: Number(body.amount),
      cashReceivedFromBank: body.cashReceivedFromBank !== undefined ? Number(body.cashReceivedFromBank) : undefined,
      natureOfTransaction: body.natureOfTransaction,
      entryType: body.entryType,
      items: body.items,
      createdById: user.id,
    });

    return res.status(201).json({ status: "success", data: entry });
  } catch (err: any) {
    console.error("[LedgerController.create]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error creating ledger entry." });
  }
}

export async function listLedgerEntriesHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const natureOfTransaction = req.query.natureOfTransaction as LedgerTransactionNature | undefined;
    const entryType = req.query.entryType as LedgerEntryType | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const [rows, total] = await listLedgerEntries({
      skip,
      take: limit,
      natureOfTransaction,
      entryType,
      startDate,
      endDate,
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
    console.error("[LedgerController.list]", err);
    return res.status(500).json({ status: "error", message: "Error listing ledger entries." });
  }
}

export async function getLedgerEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const entry = await getLedgerEntryById(id);
    if (!entry) {
      return res.status(404).json({ status: "error", message: "Ledger entry not found." });
    }
    return res.status(200).json({
      status: "success",
      data: {
        ...entry,
        createdBy: entry.createdBy ? sanitizeUser(entry.createdBy) : null,
      },
    });
  } catch (err) {
    console.error("[LedgerController.get]", err);
    return res.status(500).json({ status: "error", message: "Error retrieving ledger entry." });
  }
}

export async function updateLedgerEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const body = req.body;

    const data: any = {};
    if (body.date !== undefined) data.date = body.date;
    if (body.description !== undefined) data.description = body.description;
    if (body.amount !== undefined) data.amount = Number(body.amount);
    if (body.cashReceivedFromBank !== undefined) data.cashReceivedFromBank = Number(body.cashReceivedFromBank);
    if (body.natureOfTransaction !== undefined) data.natureOfTransaction = body.natureOfTransaction;
    if (body.entryType !== undefined) data.entryType = body.entryType;
    if (body.items !== undefined) data.items = body.items;

    const entry = await updateLedgerEntry(id, data);
    return res.status(200).json({ status: "success", data: entry });
  } catch (err: any) {
    console.error("[LedgerController.update]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error updating ledger entry." });
  }
}

export async function deleteLedgerEntryHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await softDeleteLedgerEntry(id);
    return res.status(200).json({ status: "success", message: "Ledger entry deleted." });
  } catch (err: any) {
    console.error("[LedgerController.delete]", err);
    return res.status(500).json({ status: "error", message: err.message || "Error deleting ledger entry." });
  }
}

export async function listMyLedgerHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const user = (req as any).user as User;
    const natureOfTransaction = req.query.natureOfTransaction as LedgerTransactionNature | undefined;
    const entryType = req.query.entryType as LedgerEntryType | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const [rows, total] = await listMyLedgerEntries({
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
    console.error("[LedgerController.listMy]", err);
    return res.status(500).json({ status: "error", message: "Error listing your ledger entries." });
  }
}

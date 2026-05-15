import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { BankAccountType } from "../entities/BankAccount";
import { paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import {
  createBankAccount,
  listBankAccounts,
  getBankAccountById,
  updateBankAccount,
  softDeleteBankAccount,
  setDefaultBankAccount,
} from "../services/bank-account.service";

export async function createBankAccountHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const account = await createBankAccount({
      ...req.body,
      createdById: user.id,
    });
    return res.status(201).json({ status: "success", data: account });
  } catch (err: any) {
    console.error("[BankAccountController.create]", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal server error." });
  }
}

export async function listBankAccountsHandler(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const accountType = req.query.accountType as string as BankAccountType | undefined;
    const currency = req.query.currency as string | undefined;
    const includeInactive = req.query.includeInactive === "true";

    const [rows, total] = await listBankAccounts({ skip, take: limit, accountType, currency, includeInactive });
    const sanitized = rows.map((row) => ({
      ...row,
      createdBy: row.createdBy ? sanitizeUser(row.createdBy) : null,
    }));
    return res.status(200).json({
      status: "success",
      data: sanitized,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[BankAccountController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function getBankAccountHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const account = await getBankAccountById(id);
    if (!account) {
      return res.status(404).json({ status: "error", message: "Bank account not found." });
    }
    return res.status(200).json({
      status: "success",
      data: {
        ...account,
        createdBy: account.createdBy ? sanitizeUser(account.createdBy) : null,
      },
    });
  } catch (err) {
    console.error("[BankAccountController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

export async function updateBankAccountHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const account = await updateBankAccount(id, req.body);
    return res.status(200).json({ status: "success", data: account });
  } catch (err: any) {
    console.error("[BankAccountController.update]", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal server error." });
  }
}

export async function deleteBankAccountHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await softDeleteBankAccount(id);
    return res.status(200).json({ status: "success", message: "Bank account deleted." });
  } catch (err: any) {
    console.error("[BankAccountController.delete]", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal server error." });
  }
}

export async function setDefaultBankAccountHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const account = await setDefaultBankAccount(id);
    return res.status(200).json({ status: "success", data: account });
  } catch (err: any) {
    console.error("[BankAccountController.setDefault]", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal server error." });
  }
}

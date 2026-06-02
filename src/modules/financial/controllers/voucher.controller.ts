import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { FinanceVoucher, VoucherStatus } from "../entities/FinanceVoucher";
import { User } from "../../users/entities/User";
import { uploadFile, resolveSignatureUrl } from "../../../utils/storage.service";
import { generateEglId, paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { createCashbookEntry } from "../services/cashbook.service";
import { TransactionNature, EntryType } from "../entities/CashbookEntry";

const repo = () => AppDataSource.getRepository(FinanceVoucher);

/**
 * Create a new voucher (supporting Request for Cash, Payment Authority, and Cash Payment Voucher)
 * POST /api/vouchers
 */
export async function createVoucher(req: Request, res: Response) {
  try {
    const creator = (req as any).user as User;
    const body = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Upload files if present
    let receiptUrl = body.receiptUrl;
    if (files?.receipt?.[0]) {
      const uploaded = await uploadFile(
        files.receipt[0].buffer,
        files.receipt[0].originalname,
        files.receipt[0].mimetype,
        "receipts"
      );
      receiptUrl = uploaded.key;
    }

    let staffSignatureUrl = body.staffSignatureUrl;
    if (files?.staffSignature?.[0]) {
      const uploaded = await uploadFile(
        files.staffSignature[0].buffer,
        files.staffSignature[0].originalname,
        files.staffSignature[0].mimetype,
        "signatures"
      );
      staffSignatureUrl = uploaded.key;
    } else if (body.staffId) {
      // Fallback to staff's pre-configured signature if available
      const staffUser = await AppDataSource.getRepository(User).findOne({ where: { id: body.staffId } });
      if (staffUser?.signatureUrl) {
        staffSignatureUrl = staffUser.signatureUrl;
      }
    } else if (body.voucherType === "REQUEST_FOR_CASH") {
      // Fallback to creator's signature if they are the staff
      if (creator.signatureUrl) {
        staffSignatureUrl = creator.signatureUrl;
      }
    }

    let receivedBySignatureUrl = body.receivedBySignatureUrl;
    if (files?.receivedBySignature?.[0]) {
      const uploaded = await uploadFile(
        files.receivedBySignature[0].buffer,
        files.receivedBySignature[0].originalname,
        files.receivedBySignature[0].mimetype,
        "signatures"
      );
      receivedBySignatureUrl = uploaded.key;
    } else if (body.receivedById) {
      const recUser = await AppDataSource.getRepository(User).findOne({ where: { id: body.receivedById } });
      if (recUser?.signatureUrl) {
        receivedBySignatureUrl = recUser.signatureUrl;
      }
    }

    let issuedBySignatureUrl = body.issuedBySignatureUrl;
    if (files?.issuedBySignature?.[0]) {
      const uploaded = await uploadFile(
        files.issuedBySignature[0].buffer,
        files.issuedBySignature[0].originalname,
        files.issuedBySignature[0].mimetype,
        "signatures"
      );
      issuedBySignatureUrl = uploaded.key;
    } else if (body.issuedById) {
      const issUser = await AppDataSource.getRepository(User).findOne({ where: { id: body.issuedById } });
      if (issUser?.signatureUrl) {
        issuedBySignatureUrl = issUser.signatureUrl;
      }
    } else {
      // Fallback to creator's signature as issuer
      if (creator.signatureUrl) {
        issuedBySignatureUrl = creator.signatureUrl;
      }
    }

    // Since generateEglId expects "TRK" | "SHIP" | "PAY" | "REF", we cast VCH to bypass strict type check or map it.
    // Let's typecast as any to satisfy generateEglId parameter requirement.
    const voucherNumber = generateEglId("PAY" as any).replace("-PAY-", "-VCH-");

    const voucher = repo().create({
      voucherNumber,
      voucherType: body.voucherType,
      date: body.date,
      purpose: body.purpose,
      amount: Number(body.amount),
      totalAmount: body.totalAmount ? Number(body.totalAmount) : Number(body.amount),
      status: VoucherStatus.PENDING,
      receiptUrl,
      
      // Request for Cash fields
      staffId: body.staffId || undefined,
      staffSignatureUrl,

      // Payment Authority fields
      bankTransferDate: body.bankTransferDate || undefined,
      beneficiaryName: body.beneficiaryName || undefined,

      // Cash Payment Voucher fields
      particulars: body.particulars,
      amountInWords: body.amountInWords || undefined,
      itemsDescription: body.itemsDescription || undefined,
      itemsCount: body.itemsCount ? Number(body.itemsCount) : undefined,
      receivedById: body.receivedById || undefined,
      receivedByName: body.receivedByName || undefined,
      receivedBySignatureUrl,
      issuedById: body.issuedById || undefined,
      issuedBySignatureUrl,

      createdById: creator.id,
    });

    await repo().save(voucher);

    // Audit Log
    createAuditLog({
      entityType: "FinanceVoucher",
      entityId: voucher.id,
      action: AuditAction.CREATE,
      actionDetails: { voucherNumber, voucherType: body.voucherType, amount: body.amount },
      performedBy: creator.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({
      status: "success",
      message: "Voucher created successfully.",
      data: voucher,
    });
  } catch (err) {
    console.error("[VoucherController.create]", err);
    return res.status(500).json({ status: "error", message: "Error creating voucher." });
  }
}

/**
 * Get details of a specific voucher
 * GET /api/vouchers/:id
 */
export async function getVoucher(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const voucher = await repo().findOne({
      where: { id },
      relations: ["staff", "receivedBy", "issuedBy", "authorizedBy", "createdBy", "paidBy"],
    });

    if (!voucher) {
      return res.status(404).json({ status: "error", message: "Voucher not found." });
    }

    // Resolve stored keys to presigned URLs for all signature/receipt fields
    const [
      receiptUrl,
      staffSignatureUrl,
      receivedBySignatureUrl,
      issuedBySignatureUrl,
      authorizedSignatureUrl,
      paidBySignatureUrl,
      paymentEvidenceUrl,
    ] = await Promise.all([
      resolveSignatureUrl(voucher.receiptUrl),
      resolveSignatureUrl(voucher.staffSignatureUrl),
      resolveSignatureUrl(voucher.receivedBySignatureUrl),
      resolveSignatureUrl(voucher.issuedBySignatureUrl),
      resolveSignatureUrl(voucher.authorizedSignatureUrl),
      resolveSignatureUrl(voucher.paidBySignatureUrl),
      resolveSignatureUrl(voucher.paymentEvidenceUrl),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        ...voucher,
        receiptUrl,
        staffSignatureUrl,
        receivedBySignatureUrl,
        issuedBySignatureUrl,
        authorizedSignatureUrl,
        paidBySignatureUrl,
        paymentEvidenceUrl,
        staff: voucher.staff ? sanitizeUser(voucher.staff) : undefined,
        receivedBy: voucher.receivedBy ? sanitizeUser(voucher.receivedBy) : undefined,
        issuedBy: voucher.issuedBy ? sanitizeUser(voucher.issuedBy) : undefined,
        authorizedBy: voucher.authorizedBy ? sanitizeUser(voucher.authorizedBy) : undefined,
        createdBy: voucher.createdBy ? sanitizeUser(voucher.createdBy) : undefined,
        paidBy: voucher.paidBy ? sanitizeUser(voucher.paidBy) : undefined,
      },
    });
  } catch (err) {
    console.error("[VoucherController.get]", err);
    return res.status(500).json({ status: "error", message: "Error retrieving voucher." });
  }
}

/**
 * List vouchers with pagination and filtering
 * GET /api/vouchers
 */
export async function listVouchers(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { voucherType, status } = req.query;

    const where: any = {};
    if (voucherType) where.voucherType = voucherType;
    if (status) where.status = status;

    const [rows, total] = await repo().findAndCount({
      where,
      relations: ["createdBy", "staff", "paidBy"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    const sanitizedRows = await Promise.all(
      rows.map(async (v) => ({
        ...v,
        receiptUrl: await resolveSignatureUrl(v.receiptUrl),
        staffSignatureUrl: await resolveSignatureUrl(v.staffSignatureUrl),
        receivedBySignatureUrl: await resolveSignatureUrl(v.receivedBySignatureUrl),
        issuedBySignatureUrl: await resolveSignatureUrl(v.issuedBySignatureUrl),
        authorizedSignatureUrl: await resolveSignatureUrl(v.authorizedSignatureUrl),
        paidBySignatureUrl: await resolveSignatureUrl(v.paidBySignatureUrl),
        paymentEvidenceUrl: await resolveSignatureUrl(v.paymentEvidenceUrl),
        createdBy: sanitizeUser(v.createdBy),
        staff: v.staff ? sanitizeUser(v.staff) : undefined,
        paidBy: v.paidBy ? sanitizeUser(v.paidBy) : undefined,
      }))
    );

    return res.status(200).json({
      status: "success",
      data: sanitizedRows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[VoucherController.list]", err);
    return res.status(500).json({ status: "error", message: "Error listing vouchers." });
  }
}

/**
 * List the current user's own voucher requests (their history)
 * GET /api/vouchers/my
 */
export async function listMyVouchers(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { voucherType, status } = req.query;
    const currentUser = (req as any).user as User;

    const where: any = { createdById: currentUser.id };
    if (voucherType) where.voucherType = voucherType;
    if (status) where.status = status;

    const [rows, total] = await repo().findAndCount({
      where,
      relations: ["createdBy", "staff", "authorizedBy", "paidBy"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    const sanitizedRows = await Promise.all(
      rows.map(async (v) => ({
        ...v,
        receiptUrl: await resolveSignatureUrl(v.receiptUrl),
        staffSignatureUrl: await resolveSignatureUrl(v.staffSignatureUrl),
        receivedBySignatureUrl: await resolveSignatureUrl(v.receivedBySignatureUrl),
        issuedBySignatureUrl: await resolveSignatureUrl(v.issuedBySignatureUrl),
        authorizedSignatureUrl: await resolveSignatureUrl(v.authorizedSignatureUrl),
        paidBySignatureUrl: await resolveSignatureUrl(v.paidBySignatureUrl),
        paymentEvidenceUrl: await resolveSignatureUrl(v.paymentEvidenceUrl),
        createdBy: sanitizeUser(v.createdBy),
        staff: v.staff ? sanitizeUser(v.staff) : undefined,
        authorizedBy: v.authorizedBy ? sanitizeUser(v.authorizedBy) : undefined,
        paidBy: v.paidBy ? sanitizeUser(v.paidBy) : undefined,
      }))
    );

    return res.status(200).json({
      status: "success",
      data: sanitizedRows,
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[VoucherController.listMy]", err);
    return res.status(500).json({ status: "error", message: "Error listing your vouchers." });
  }
}

/**
 * Approve or Reject a voucher
 * PATCH /api/vouchers/:id/status
 */
export async function updateVoucherStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, rejectionReason, authorizedSignatureUrl } = req.body;
    const authorizer = (req as any).user as User;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const voucher = await repo().findOne({ where: { id } });
    if (!voucher) {
      return res.status(404).json({ status: "error", message: "Voucher not found." });
    }

    if (voucher.status !== VoucherStatus.PENDING) {
      return res.status(400).json({
        status: "error",
        message: `Voucher status cannot be changed. It is already ${voucher.status}.`,
      });
    }

    let finalAuthorizedSignatureUrl = authorizedSignatureUrl;
    if (files?.authorizedSignature?.[0]) {
      const uploaded = await uploadFile(
        files.authorizedSignature[0].buffer,
        files.authorizedSignature[0].originalname,
        files.authorizedSignature[0].mimetype,
        "signatures"
      );
      finalAuthorizedSignatureUrl = uploaded.key;
    } else {
      // Fallback to preconfigured signature of the authorizing manager/admin
      if (authorizer.signatureUrl) {
        finalAuthorizedSignatureUrl = authorizer.signatureUrl;
      }
    }

    voucher.status = status;
    voucher.authorizedById = authorizer.id;
    voucher.authorizedAt = new Date();
    voucher.authorizedSignatureUrl = finalAuthorizedSignatureUrl || voucher.authorizedSignatureUrl;
    
    if (status === VoucherStatus.REJECTED) {
      voucher.rejectionReason = rejectionReason || "No reason provided.";
    }

    await repo().save(voucher);

    // Audit Log
    createAuditLog({
      entityType: "FinanceVoucher",
      entityId: voucher.id,
      action: status === VoucherStatus.APPROVED ? AuditAction.UPDATE : AuditAction.DELETE,
      actionDetails: { event: `voucher_${status.toLowerCase()}`, voucherNumber: voucher.voucherNumber },
      performedBy: authorizer.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Resolve stored keys to presigned URLs for response
    const [
      resolvedReceiptUrl,
      resolvedStaffSignatureUrl,
      resolvedReceivedBySignatureUrl,
      resolvedIssuedBySignatureUrl,
      resolvedAuthorizedSignatureUrl,
    ] = await Promise.all([
      resolveSignatureUrl(voucher.receiptUrl),
      resolveSignatureUrl(voucher.staffSignatureUrl),
      resolveSignatureUrl(voucher.receivedBySignatureUrl),
      resolveSignatureUrl(voucher.issuedBySignatureUrl),
      resolveSignatureUrl(voucher.authorizedSignatureUrl),
    ]);

    return res.status(200).json({
      status: "success",
      message: `Voucher ${status.toLowerCase()} successfully.`,
      data: {
        ...voucher,
        receiptUrl: resolvedReceiptUrl,
        staffSignatureUrl: resolvedStaffSignatureUrl,
        receivedBySignatureUrl: resolvedReceivedBySignatureUrl,
        issuedBySignatureUrl: resolvedIssuedBySignatureUrl,
        authorizedSignatureUrl: resolvedAuthorizedSignatureUrl,
      },
    });
  } catch (err) {
    console.error("[VoucherController.updateStatus]", err);
    return res.status(500).json({ status: "error", message: "Error updating voucher status." });
  }
}

/**
 * Mark an approved voucher as paid with evidence of disbursement.
 * Only vouchers in APPROVED status can be marked as paid.
 * POST /api/vouchers/:id/pay
 */
export async function markVoucherAsPaid(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { paymentMethod, paymentReference, paymentNotes, paidBySignatureUrl } = req.body;
    const payer = (req as any).user as User;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const voucher = await repo().findOne({ where: { id } });
    if (!voucher) {
      return res.status(404).json({ status: "error", message: "Voucher not found." });
    }

    // Guard: only APPROVED vouchers can be marked as paid
    if (voucher.status !== VoucherStatus.APPROVED) {
      return res.status(400).json({
        status: "error",
        message: `Only approved vouchers can be marked as paid. This voucher is currently ${voucher.status}.`,
      });
    }

    // Upload payment evidence file if provided
    let paymentEvidenceUrl = req.body.paymentEvidenceUrl;
    if (files?.paymentEvidence?.[0]) {
      const uploaded = await uploadFile(
        files.paymentEvidence[0].buffer,
        files.paymentEvidence[0].originalname,
        files.paymentEvidence[0].mimetype,
        "receipts"
      );
      paymentEvidenceUrl = uploaded.key;
    }

    // Handle signature — uploaded file overrides body URL
    let finalPaidBySignatureUrl = paidBySignatureUrl;
    if (files?.paidBySignature?.[0]) {
      const uploaded = await uploadFile(
        files.paidBySignature[0].buffer,
        files.paidBySignature[0].originalname,
        files.paidBySignature[0].mimetype,
        "signatures"
      );
      finalPaidBySignatureUrl = uploaded.key;
    } else if (payer.signatureUrl) {
      // Fallback to payer's pre-configured signature
      finalPaidBySignatureUrl = payer.signatureUrl;
    }

    // Update voucher with payment information
    voucher.status = VoucherStatus.PAID;
    voucher.paidAt = new Date();
    voucher.paidById = payer.id;
    voucher.paidBySignatureUrl = finalPaidBySignatureUrl || voucher.paidBySignatureUrl;
    voucher.paymentEvidenceUrl = paymentEvidenceUrl || voucher.paymentEvidenceUrl;
    voucher.paymentMethod = paymentMethod;
    voucher.paymentReference = paymentReference || undefined;
    voucher.paymentNotes = paymentNotes || undefined;

    await repo().save(voucher);

    // Auto-create a cashbook entry recording the disbursement (CREDIT = money out)
    const isBankTransfer = paymentMethod?.toLowerCase().includes("bank") || paymentMethod?.toLowerCase().includes("transfer");
    const nature = isBankTransfer ? TransactionNature.BANK : TransactionNature.CASH;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    createCashbookEntry({
      date: today,
      natureOfTransaction: nature,
      entryType: EntryType.CREDIT, // money has left the account
      amount: voucher.amount,
      description: `Payment for voucher ${voucher.voucherNumber} — ${paymentMethod}`,
      voucherId: voucher.id,
      createdById: payer.id,
    }).catch((err) => {
      console.error("[VoucherController.markPaid] Failed to create cashbook entry:", err);
    });

    // Audit Log
    createAuditLog({
      entityType: "FinanceVoucher",
      entityId: voucher.id,
      action: AuditAction.VOUCHER_PAID,
      actionDetails: {
        event: "voucher_paid",
        voucherNumber: voucher.voucherNumber,
        amount: voucher.amount,
        paymentMethod,
        paymentReference,
      },
      performedBy: payer.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Resolve stored keys to presigned URLs for the response
    const [
      resolvedReceiptUrl,
      resolvedStaffSignatureUrl,
      resolvedReceivedBySignatureUrl,
      resolvedIssuedBySignatureUrl,
      resolvedAuthorizedSignatureUrl,
      resolvedPaidBySignatureUrl,
      resolvedPaymentEvidenceUrl,
    ] = await Promise.all([
      resolveSignatureUrl(voucher.receiptUrl),
      resolveSignatureUrl(voucher.staffSignatureUrl),
      resolveSignatureUrl(voucher.receivedBySignatureUrl),
      resolveSignatureUrl(voucher.issuedBySignatureUrl),
      resolveSignatureUrl(voucher.authorizedSignatureUrl),
      resolveSignatureUrl(voucher.paidBySignatureUrl),
      resolveSignatureUrl(voucher.paymentEvidenceUrl),
    ]);

    return res.status(200).json({
      status: "success",
      message: "Voucher marked as paid successfully.",
      data: {
        ...voucher,
        receiptUrl: resolvedReceiptUrl,
        staffSignatureUrl: resolvedStaffSignatureUrl,
        receivedBySignatureUrl: resolvedReceivedBySignatureUrl,
        issuedBySignatureUrl: resolvedIssuedBySignatureUrl,
        authorizedSignatureUrl: resolvedAuthorizedSignatureUrl,
        paidBySignatureUrl: resolvedPaidBySignatureUrl,
        paymentEvidenceUrl: resolvedPaymentEvidenceUrl,
      },
    });
  } catch (err) {
    console.error("[VoucherController.markPaid]", err);
    return res.status(500).json({ status: "error", message: "Error marking voucher as paid." });
  }
}

import { Request, Response } from "express";
import { AppDataSource } from "../../../../database/data-source";
import { FinanceVoucher, VoucherStatus } from "../entities/FinanceVoucher";
import { User } from "../../users/entities/User";
import { uploadFile } from "../../../utils/storage.service";
import { generateEglId, paginate, parsePagination, sanitizeUser } from "../../../utils/helpers";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";

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
      receiptUrl = uploaded.url;
    }

    let staffSignatureUrl = body.staffSignatureUrl;
    if (files?.staffSignature?.[0]) {
      const uploaded = await uploadFile(
        files.staffSignature[0].buffer,
        files.staffSignature[0].originalname,
        files.staffSignature[0].mimetype,
        "signatures"
      );
      staffSignatureUrl = uploaded.url;
    }

    let receivedBySignatureUrl = body.receivedBySignatureUrl;
    if (files?.receivedBySignature?.[0]) {
      const uploaded = await uploadFile(
        files.receivedBySignature[0].buffer,
        files.receivedBySignature[0].originalname,
        files.receivedBySignature[0].mimetype,
        "signatures"
      );
      receivedBySignatureUrl = uploaded.url;
    }

    let issuedBySignatureUrl = body.issuedBySignatureUrl;
    if (files?.issuedBySignature?.[0]) {
      const uploaded = await uploadFile(
        files.issuedBySignature[0].buffer,
        files.issuedBySignature[0].originalname,
        files.issuedBySignature[0].mimetype,
        "signatures"
      );
      issuedBySignatureUrl = uploaded.url;
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
      relations: ["staff", "receivedBy", "issuedBy", "authorizedBy", "createdBy"],
    });

    if (!voucher) {
      return res.status(404).json({ status: "error", message: "Voucher not found." });
    }

    return res.status(200).json({
      status: "success",
      data: {
        ...voucher,
        staff: voucher.staff ? sanitizeUser(voucher.staff) : undefined,
        receivedBy: voucher.receivedBy ? sanitizeUser(voucher.receivedBy) : undefined,
        issuedBy: voucher.issuedBy ? sanitizeUser(voucher.issuedBy) : undefined,
        authorizedBy: voucher.authorizedBy ? sanitizeUser(voucher.authorizedBy) : undefined,
        createdBy: voucher.createdBy ? sanitizeUser(voucher.createdBy) : undefined,
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
      relations: ["createdBy", "staff"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    const sanitizedRows = rows.map((v) => ({
      ...v,
      createdBy: sanitizeUser(v.createdBy),
      staff: v.staff ? sanitizeUser(v.staff) : undefined,
    }));

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
      finalAuthorizedSignatureUrl = uploaded.url;
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

    return res.status(200).json({
      status: "success",
      message: `Voucher ${status.toLowerCase()} successfully.`,
      data: voucher,
    });
  } catch (err) {
    console.error("[VoucherController.updateStatus]", err);
    return res.status(500).json({ status: "error", message: "Error updating voucher status." });
  }
}

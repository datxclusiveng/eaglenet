import { Request, Response } from "express";
import https from "https";
import { AppDataSource } from "../../database/data-source";
import { Payment, PaymentStatus } from "../entities/Payment";
import { Shipment } from "../entities/Shipment";
import { User } from "../entities/User";
import { generateEglId, paginate, parsePagination } from "../utils/helpers";
import { sendPaymentConfirmationEmail } from "../services/email.service";

const repo = () => AppDataSource.getRepository(Payment);

// ─── Customer: Initialise a Paystack payment for a shipment ──────────────────

export async function initializePayment(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { shipmentId, amount } = req.body;

    if (!shipmentId || !amount) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "shipmentId and amount are required.",
        });
    }

    const shipment = await AppDataSource.getRepository(Shipment).findOne({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return res
        .status(404)
        .json({ status: "error", message: "Shipment not found." });
    }

    // Only allow the owner or admin to pay
    if (shipment.userId && shipment.userId !== user.id) {
      return res.status(403).json({ status: "error", message: "Forbidden." });
    }

    const reference = generateEglId("REF");
    const paymentId = generateEglId("PAY");
    const amountInKobo = Math.round(Number(amount) * 100);

    // Hit Paystack initialize endpoint
    const callback_url = `${process.env.FRONTEND_URL}/customer-dashboard/shipments`;

    const paystackRes = await paystackRequest<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>("POST", "/transaction/initialize", {
      email: user.email,
      amount: amountInKobo,
      reference,
      callback_url,
      metadata: {
        shipmentId,
        userId: user.id,
        paymentId,
      },
    });

    // Persist a PENDING payment record
    const payment = repo().create({
      paymentId,
      reference,
      amount: Number(amount),
      status: PaymentStatus.PENDING,
      userId: user.id,
      shipmentId,
      paystackAccessCode: paystackRes.access_code,
      paystackAuthUrl: paystackRes.authorization_url,
    });

    await repo().save(payment);

    return res.status(200).json({
      status: "success",
      message: "Payment initialized.",
      data: {
        paymentId,
        reference,
        authorizationUrl: paystackRes.authorization_url,
        accessCode: paystackRes.access_code,
      },
    });
  } catch (err) {
    console.error("[PaymentController.initializePayment]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Paystack Webhook ─────────────────────────────────────────────────────────

export async function paystackWebhook(req: Request, res: Response) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY!;
    const crypto = await import("crypto");
    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid signature." });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const ref = event.data.reference as string;
      const payment = await repo().findOne({
        where: { reference: ref },
        relations: ["user", "shipment"],
      });

      if (payment && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.SUCCESS;
        await repo().save(payment);

        // Update shipment amount if needed
        if (payment.shipment) {
          payment.shipment.amount = payment.amount;
          await AppDataSource.getRepository(Shipment).save(payment.shipment);
        }

        // Email
        sendPaymentConfirmationEmail(payment.user.email, {
          fullName: `${payment.user.firstName} ${payment.user.lastName}`,
          paymentId: payment.paymentId,
          reference: payment.reference,
          amount: payment.amount,
          status: "SUCCESS",
          shippingId: payment.shipment?.shippingId,
        }).catch(console.error);
      }
    }

    if (event.event === "charge.failed") {
      const ref = event.data.reference as string;
      const payment = await repo().findOne({ where: { reference: ref } });
      if (payment && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.FAILED;
        await repo().save(payment);
      }
    }

    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("[PaymentController.paystackWebhook]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Verify a payment manually (polling fallback) ────────────────────────────

export async function verifyPayment(req: Request, res: Response) {
  try {
    const { reference } = req.params;
    const user = (req as any).user as User;

    const payment = await repo().findOne({
      where: { reference },
      relations: ["user", "shipment"],
    });

    if (!payment) {
      return res
        .status(404)
        .json({ status: "error", message: "Payment not found." });
    }

    if (
      payment.userId !== user.id &&
      !["SUPERADMIN", "ADMIN"].includes(user.role)
    ) {
      return res.status(403).json({ status: "error", message: "Forbidden." });
    }

    // Verify with Paystack if still pending
    if (payment.status === PaymentStatus.PENDING) {
      try {
        const ps = await paystackRequest<{ status: string }>(
          "GET",
          `/transaction/verify/${reference}`,
          null,
        );

        if (ps.status === "success") {
          payment.status = PaymentStatus.SUCCESS;
        } else if (ps.status === "failed") {
          payment.status = PaymentStatus.FAILED;
        }
        await repo().save(payment);
      } catch (_) {
        // Paystack error – return current DB status
      }
    }

    return res.status(200).json({ status: "success", data: payment });
  } catch (err) {
    console.error("[PaymentController.verifyPayment]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Customer: My payment history ────────────────────────────────────────────

export async function myPayments(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as PaymentStatus | undefined;
    const search = (req.query.search as string) || "";

    const qb = repo()
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.shipment", "s")
      .where("p.userId = :uid", { uid: user.id });

    if (status && Object.values(PaymentStatus).includes(status)) {
      qb.andWhere("p.status = :status", { status });
    }
    if (search) {
      qb.andWhere(
        "(p.paymentId ILIKE :s OR p.reference ILIKE :s OR s.shippingId ILIKE :s OR s.trackingId ILIKE :s)",
        { s: `%${search}%` },
      );
    }

    qb.orderBy("p.createdAt", "DESC").skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    const totalPaid = await repo()
      .createQueryBuilder("p")
      .select("COALESCE(SUM(p.amount), 0)", "total")
      .where("p.userId = :uid AND p.status = 'SUCCESS'", { uid: user.id })
      .getRawOne();

    return res.status(200).json({
      status: "success",
      data: rows,
      summary: { totalPaid: Number(totalPaid?.total || 0) },
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[PaymentController.myPayments]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: All payments ──────────────────────────────────────────────────────

export async function listPayments(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as PaymentStatus | undefined;
    const search = (req.query.search as string) || "";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const qb = repo()
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.user", "u")
      .leftJoinAndSelect("p.shipment", "s");

    if (status && Object.values(PaymentStatus).includes(status)) {
      qb.andWhere("p.status = :status", { status });
    }
    if (search) {
      qb.andWhere(
        `(p.paymentId ILIKE :s OR p.reference ILIKE :s
          OR u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s)`,
        { s: `%${search}%` },
      );
    }
    if (from) qb.andWhere("p.createdAt >= :from", { from });
    if (to) qb.andWhere("p.createdAt <= :to", { to });

    qb.orderBy("p.createdAt", "DESC").skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    // Revenue summary
    const summary = await repo()
      .createQueryBuilder("p")
      .select([
        "COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount ELSE 0 END), 0) AS \"totalRevenue\"",
        "COUNT(CASE WHEN p.status = 'SUCCESS' THEN 1 END) AS \"successful\"",
        "COUNT(CASE WHEN p.status = 'PENDING' THEN 1 END) AS \"pending\"",
        "COUNT(CASE WHEN p.status = 'FAILED' THEN 1 END) AS \"failed\"",
      ])
      .getRawOne();

    return res.status(200).json({
      status: "success",
      data: rows,
      summary: {
        totalRevenue: Number(summary.totalRevenue),
        successful: Number(summary.successful),
        pending: Number(summary.pending),
        failed: Number(summary.failed),
      },
      meta: paginate(total, page, limit),
    });
  } catch (err) {
    console.error("[PaymentController.listPayments]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Admin: Single payment detail ────────────────────────────────────────────

export async function getPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const payment = await repo().findOne({
      where: { id },
      relations: ["user", "shipment"],
    });

    if (!payment) {
      return res
        .status(404)
        .json({ status: "error", message: "Payment not found." });
    }

    return res.status(200).json({ status: "success", data: payment });
  } catch (err) {
    console.error("[PaymentController.getPayment]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Paystack HTTP helper ─────────────────────────────────────────────────────

function paystackRequest<T>(
  method: string,
  path: string,
  body: any,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: "api.paystack.co",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (r) => {
      let raw = "";
      r.on("data", (chunk) => (raw += chunk));
      r.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.status)
            return reject(new Error(parsed.message || "Paystack error"));
          resolve(parsed.data as T);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

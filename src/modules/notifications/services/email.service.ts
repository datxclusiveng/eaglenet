import { Resend } from "resend";
import nodemailer from "nodemailer";
import { AppDataSource } from "../../../../database/data-source";
import { EmailLog, EmailStatus } from "../entities/EmailLog";

// ─── Provider Setup ──────────────────────────────────────────────────────────

type MailProvider = "resend" | "smtp" | "console";

const getEnv = (key: string, fallback: string = ""): string => {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split("#")[0].trim();
};

const PROVIDER: MailProvider = getEnv("MAIL_PROVIDER", "resend") as MailProvider;
const ENABLED = getEnv("MAILING_ENABLED", "1") !== "0";
const BRAND = "EagleNet Logistics";

const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = getEnv("MAIL_FROM", "onboarding@resend.dev");

const smtpTransporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: getEnv("SMTP_HOST"),
      port: parseInt(getEnv("SMTP_PORT", "587")),
      secure: getEnv("SMTP_SECURE") === "true",
      auth: {
        user: getEnv("SMTP_USER"),
        pass: getEnv("SMTP_PASS"),
      },
    })
  : null;

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  shipmentId?: string;
  invoiceId?: string;
  templateUsed?: string;
  sentById?: string;
}

async function logEmail(payload: EmailPayload, status: EmailStatus, error?: string) {
  try {
    const repo = AppDataSource.getRepository(EmailLog);
    const log = repo.create({
      recipientEmail: payload.to,
      subject: payload.subject,
      shipmentId: payload.shipmentId,
      invoiceId: payload.invoiceId,
      templateUsed: payload.templateUsed,
      sentById: payload.sentById,
      status,
      errorMessage: error,
    });
    await repo.save(log);
  } catch (err) {
    console.error("[EmailService] Failed to log email:", err);
  }
}

async function send(payload: EmailPayload) {
  if (!ENABLED) {
    console.info(`[EmailService] Mailing disabled. Subject: ${payload.subject} → ${payload.to}`);
    return;
  }

  let status = EmailStatus.SENT;
  let errorMessage: string | undefined;

  try {
    if (PROVIDER === "console") {
      console.info(`To: ${payload.to} | Sub: ${payload.subject}`);
    } else if (PROVIDER === "smtp" && smtpTransporter) {
      await smtpTransporter.sendMail({ from: MAIL_FROM, ...payload });
    } else {
      await resend.emails.send({ from: MAIL_FROM, to: payload.to, subject: payload.subject, html: payload.html });
    }
  } catch (err: any) {
    status = EmailStatus.FAILED;
    errorMessage = err.message || String(err);
    console.error("[EmailService] Send failed:", err);
  }

  await logEmail(payload, status, errorMessage);
}

// ─── Template helpers ──────────────────────────────────────────────────────────

function base(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
    .header span { color: #e8a835; }
    .body { padding: 32px; color: #333; line-height: 1.7; }
    .body h2 { color: #1a1a2e; margin-top: 0; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table td { padding: 10px 14px; border-bottom: 1px solid #eee; }
    .info-table td:first-child { font-weight: bold; color: #555; width: 40%; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
    .badge-pending { background: #fff3cd; color: #856404; }
    .badge-transit { background: #cce5ff; color: #004085; }
    .badge-success { background: #d4edda; color: #155724; }
    .footer { background: #f8f8f8; padding: 20px 32px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1><span>Eagle</span>Net Logistics</h1></div>
    <div class="body">${content}</div>
    <div class="footer">&copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.</div>
  </div>
</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function sendBookingConfirmationEmail(
  to: string,
  data: {
    fullName: string;
    trackingId: string;
    type: string;
    origin: string;
    destination: string;
    eta: string;
    carrier: string;
    shipmentId?: string;
  },
) {
  await send({
    to,
    subject: `Shipment Confirmation — ${data.trackingId}`,
    templateUsed: "shipment_confirmation",
    shipmentId: data.shipmentId,
    html: base(`
      <h2>Your shipment has been booked.</h2>
      <p>Hi <strong>${data.fullName}</strong>, your ${data.type.replace("_", " ")} shipment is in our system.</p>
      <table class="info-table">
        <tr><td>Tracking Number</td><td>${data.trackingId}</td></tr>
        <tr><td>Origin</td><td>${data.origin}</td></tr>
        <tr><td>Destination</td><td>${data.destination}</td></tr>
        <tr><td>Carrier</td><td>${data.carrier}</td></tr>
        <tr><td>Est. Arrival</td><td>${data.eta}</td></tr>
      </table>
      <p>Keep this tracking number safe to monitor your shipment progress.</p>`),
  });
}

export async function sendStatusUpdateEmail(
  to: string,
  data: {
    fullName: string;
    trackingId: string;
    status: string;
    origin: string;
    destination: string;
    shipmentId?: string;
  },
) {
  const statusMap: Record<string, string> = {
    pending: "badge-pending",
    in_transit: "badge-transit",
    arrived: "badge-success",
    delivered: "badge-success",
  };
  await send({
    to,
    subject: `Update: Shipment ${data.trackingId}`,
    templateUsed: "shipment_update",
    shipmentId: data.shipmentId,
    html: base(`
      <h2>Shipment Status Update 📦</h2>
      <p>Hi <strong>${data.fullName}</strong>, here's the latest update.</p>
      <table class="info-table">
        <tr><td>Tracking Number</td><td>${data.trackingId}</td></tr>
        <tr><td>Current Status</td><td><span class="badge ${statusMap[data.status] || ""}">${data.status.replace("_", " ").toUpperCase()}</span></td></tr>
      </table>`),
  });
}

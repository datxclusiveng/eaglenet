import { Resend } from "resend";
import nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import Handlebars from "handlebars";
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
  html?: string;
  shipmentId?: string;
  invoiceId?: string;
  templateUsed?: string;
  sentById?: string;
  templateData?: any;
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

/**
 * Loads and compiles a Handlebars template.
 */
function compileTemplate(templateName: string, data: any): string {
  try {
    const templatePath = path.join(process.cwd(), "src", "templates", "emails", `${templateName}.hbs`);
    if (!fs.existsSync(templatePath)) {
      console.warn(`[EmailService] Template not found: ${templateName}.`);
      return data.content || "Template missing";
    }
    const source = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(source);
    return template(data);
  } catch (err) {
    console.error(`[EmailService] Template compilation error (${templateName}):`, err);
    return "Compilation error";
  }
}

async function send(payload: EmailPayload) {
  if (!ENABLED) {
    console.info(`[EmailService] Mailing disabled. Subject: ${payload.subject} → ${payload.to}`);
    return;
  }

  // Pre-process template if specified
  if (payload.templateUsed && payload.templateData) {
    payload.html = compileTemplate(payload.templateUsed, {
      ...payload.templateData,
      brandName: BRAND,
      year: new Date().getFullYear(),
    });
  }

  if (!payload.html) {
      console.error("[EmailService] No content provided (html or template).");
      return;
  }

  let status = EmailStatus.SENT;
  let errorMessage: string | undefined;

  try {
    if (PROVIDER === "console") {
      console.info(`To: ${payload.to} | Sub: ${payload.subject}`);
    } else if (PROVIDER === "smtp" && smtpTransporter) {
      await smtpTransporter.sendMail({ from: MAIL_FROM, to: payload.to, subject: payload.subject, html: payload.html });
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
    templateUsed: "notification", // Fallback to safe template
    shipmentId: data.shipmentId,
    templateData: {
      title: "Booking Confirmed",
      customerName: data.fullName,
      mainContent: `Your ${data.type.replace("_", " ")} shipment from ${data.origin} to ${data.destination} has been booked.`,
      shipmentId: data.trackingId,
      status: "PENDING",
    },
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
  await send({
    to,
    subject: `Update: Shipment ${data.trackingId}`,
    templateUsed: "notification",
    shipmentId: data.shipmentId,
    templateData: {
      title: "Status Update",
      customerName: data.fullName,
      mainContent: `The status of your shipment ${data.trackingId} has been updated.`,
      shipmentId: data.trackingId,
      status: data.status.replace("_", " ").toUpperCase(),
    },
  });
}

export async function sendWelcomeEmail(to: string, fullName: string) {
    await send({
        to,
        subject: `Welcome to ${BRAND}`,
        templateUsed: "welcome",
        templateData: {
            customerName: fullName,
            mainContent: "Your account has been created successfully. Welcome aboard!",
        }
    });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
    await send({
        to,
        subject: "Password Reset Request",
        templateUsed: "password-reset",
        templateData: {
            resetLink
        }
    });
}

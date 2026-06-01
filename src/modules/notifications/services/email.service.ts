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
const APP_URL = getEnv("APP_URL", "http://localhost:3000"); // Base URL for assets

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

interface AttachmentDef {
  filename: string;
  content: Buffer;
  content_type: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  shipmentId?: string;
  invoiceId?: string;
  templateUsed?: string;
  sentById?: string;
  templateData?: any;
  attachments?: AttachmentDef[];
  attachmentUrls?: string; // JSON array of { name, url } for audit log
}

async function logEmail(payload: EmailPayload, status: EmailStatus, error?: string) {
  try {
    const repo = AppDataSource.getRepository(EmailLog);
    const logData: Record<string, any> = {
      recipientEmail: payload.to,
      subject: payload.subject,
      shipmentId: payload.shipmentId,
      invoiceId: payload.invoiceId,
      templateUsed: payload.templateUsed,
      sentById: payload.sentById,
      status,
      body: payload.html,
      errorMessage: error,
    };
    if (payload.attachments?.length) {
      logData.attachmentCount = payload.attachments.length;
    }
    if (payload.attachmentUrls) {
      logData.attachmentUrls = payload.attachmentUrls;
    }
    const log = repo.create(logData as any);
    await repo.save(log);
  } catch (err) {
    console.error("[EmailService] Failed to log email:", err);
  }
}

// ─── Partial Registration ─────────────────────────────────────────────────────
// Registers all .hbs files in the partials/ directory once at startup.
// This must run before any template is compiled, otherwise {{> layout}} will throw.

let partialsRegistered = false;

function registerPartials() {
  if (partialsRegistered) return;
  // Fallback so {{> @partial-block}} is a no-op when layout called via {{> layout}} (non-block)
  Handlebars.registerPartial("@partial-block", "");
  const partialsDir = path.join(process.cwd(), "src", "templates", "emails", "partials");
  if (!fs.existsSync(partialsDir)) {
    console.warn("[EmailService] Partials directory not found:", partialsDir);
    partialsRegistered = true;
    return;
  }
  const files = fs.readdirSync(partialsDir).filter((f) => f.endsWith(".hbs"));
  for (const file of files) {
    const name = path.basename(file, ".hbs");
    const content = fs.readFileSync(path.join(partialsDir, file), "utf-8");
    Handlebars.registerPartial(name, content);
  }
  console.info(`[EmailService] Registered ${files.length} Handlebars partial(s): ${files.join(", ")}`);
  partialsRegistered = true;
}

// ─── Handlebars Helpers ────────────────────────────────────────────────────────

let helpersRegistered = false;

function registerHelpers() {
  if (helpersRegistered) return;

  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper("or", function (...args: any[]) {
    args.pop(); // pop the Handlebars options object off the end
    for (const arg of args) {
      if (arg) return true;
    }
    return false;
  });

  Handlebars.registerHelper("uppercase", function (str) {
    return typeof str === "string" ? str.toUpperCase() : str;
  });

  Handlebars.registerHelper("statusClass", function (status: string) {
    if (!status) return "status-default";
    const s = status.toLowerCase().replace(/[_\s]/g, "");
    if (s === "pending" || s === "onhold" || s === "hold") return "status-pending";
    if (s === "intransit" || s === "transit" || s === "processing" || s === "customs" || s === "invoiced") return "status-transit";
    if (s === "delivered" || s === "completed") return "status-delivered";
    if (s === "cancelled" || s === "returned" || s === "failed") return "status-cancelled";
    return "status-default";
  });

  Handlebars.registerHelper("shipmentDetails", function (data: any) {
    if (!data || (!data.trackingId && !data.shipmentId)) return "";
    const statusClassFn = Handlebars.helpers.statusClass as (s: string) => string;
    const status = data.status || "Not Available";
    const badgeClass = statusClassFn(status);
    return new Handlebars.SafeString(
      `<div class="info-card"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
      (data.trackingId || data.shipmentId ? `<tr><td class="info-row"><strong>Tracking ID:</strong> ${Handlebars.escapeExpression(data.trackingId || data.shipmentId)}</td></tr>` : "") +
      (data.origin ? `<tr><td class="info-row"><strong>Origin:</strong> ${Handlebars.escapeExpression(data.origin)}</td></tr>` : "") +
      (data.destination ? `<tr><td class="info-row"><strong>Destination:</strong> ${Handlebars.escapeExpression(data.destination)}</td></tr>` : "") +
      (data.carrier ? `<tr><td class="info-row"><strong>Carrier:</strong> ${Handlebars.escapeExpression(data.carrier)}</td></tr>` : "") +
      (data.eta ? `<tr><td class="info-row"><strong>Estimated Arrival:</strong> ${Handlebars.escapeExpression(data.eta)}</td></tr>` : "") +
      `<tr><td class="info-row" style="padding-top:12px;"><strong>Status:</strong> <span class="status-badge ${badgeClass}">${Handlebars.escapeExpression(status)}</span></td></tr>` +
      `</table></div>`
    );
  });

  helpersRegistered = true;
}

/**
 * Loads and compiles a Handlebars template.
 */
function compileTemplate(templateName: string, data: any): string {
  try {
    registerHelpers();
    registerPartials();

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

export async function send(payload: EmailPayload) {
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
      logoUrl: `${APP_URL}/images.jpg`,
      brandUrl: getEnv("FRONTEND_URL", APP_URL),
    });
  }

  if (!payload.html) {
      console.error("[EmailService] No content provided (html or template).");
      return;
  }

  let status = EmailStatus.SENT;
  let errorMessage: string | undefined;

  // Build attachment arrays for providers
  const resendAttachments = payload.attachments?.map(a => ({
    filename: a.filename,
    content: a.content,
    content_type: a.content_type,
  }));

  const nodemailerAttachments = payload.attachments?.map(a => ({
    filename: a.filename,
    content: a.content,
    contentType: a.content_type,
  }));

  try {
    if (PROVIDER === "console") {
      const attNames = payload.attachments?.map(a => a.filename).join(", ") ?? "none";
      console.info(`To: ${payload.to} | Sub: ${payload.subject} | Attachments: ${attNames}`);
    } else if (PROVIDER === "smtp" && smtpTransporter) {
      await smtpTransporter.sendMail({
        from: MAIL_FROM, to: payload.to, subject: payload.subject, html: payload.html,
        attachments: nodemailerAttachments,
      });
    } else {
      await resend.emails.send({
        from: MAIL_FROM, to: payload.to, subject: payload.subject, html: payload.html,
        attachments: resendAttachments,
      });
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
    templateUsed: "notification",
    shipmentId: data.shipmentId,
    templateData: {
      title: "Booking Confirmed",
      preheader: `Your shipment ${data.trackingId} has been booked`,
      userName: data.fullName,
      mainContent: `Your <strong>${data.type.replace(/_/g, " ")}</strong> shipment has been successfully booked and is now in our system.`,
      trackingId: data.trackingId,
      origin: data.origin,
      destination: data.destination,
      eta: data.eta,
      carrier: data.carrier,
      status: "PENDING",
      cta_url: `${APP_URL}/shipments/${data.shipmentId || ""}`,
      cta_text: "Track Your Shipment",
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
  const displayStatus = data.status.replace(/_/g, " ").toUpperCase();
  await send({
    to,
    subject: `Shipment Update: ${displayStatus} — ${data.trackingId}`,
    templateUsed: "notification",
    shipmentId: data.shipmentId,
    templateData: {
      title: "Status Update",
      preheader: `Your shipment ${data.trackingId} is now ${displayStatus}`,
      userName: data.fullName,
      mainContent: `The status of your shipment <strong>${data.trackingId}</strong> has been updated. See current details below.`,
      trackingId: data.trackingId,
      origin: data.origin,
      destination: data.destination,
      status: displayStatus,
      cta_url: `${APP_URL}/shipments/${data.shipmentId || ""}`,
      cta_text: "View Shipment Details",
    },
  });
}

export async function sendWelcomeEmail(to: string, fullName: string) {
    await send({
        to,
        subject: `Welcome to ${BRAND}`,
        templateUsed: "welcome",
        templateData: {
            preheader: `${fullName}, welcome to EagleNet Logistics`,
            userName: fullName,
            cta_url: APP_URL,
            cta_text: "Go to Dashboard",
        }
    });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
    await send({
        to,
        subject: "Password Reset Request",
        templateUsed: "password-reset",
        templateData: {
            preheader: "Reset your EagleNet account password",
            resetLink,
            cta_url: resetLink,
            cta_text: "Reset Your Password",
        }
    });
}

export async function sendPasswordResetCodeEmail(to: string, fullName: string, code: string) {
    await send({
        to,
        subject: `Password Reset Code: ${code}`,
        templateUsed: "password-reset",
        templateData: {
            preheader: `Your password reset code: ${code}`,
            userName: fullName,
            resetCode: code,
        }
    });
}

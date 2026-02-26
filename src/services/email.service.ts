import { Resend } from "resend";
import nodemailer from "nodemailer";

// ─── Provider Setup ──────────────────────────────────────────────────────────

type MailProvider = "resend" | "smtp" | "console";

// Helper to clean env variables (strips comments and whitespace)
const getEnv = (key: string, fallback: string = ""): string => {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split("#")[0].trim();
};

const PROVIDER: MailProvider = getEnv(
  "MAIL_PROVIDER",
  "resend",
) as MailProvider;
const ENABLED = getEnv("MAILING_ENABLED", "1") !== "0";
const BRAND = "EagleNet Logistics";

// Resend Config
const resend = new Resend(process.env.RESEND_API_KEY);
// For Resend unverified domains, 'from' MUST be exactly 'onboarding@resend.dev'
// or 'Name <onboarding@resend.dev>'
const RESEND_FROM = getEnv("RESEND_FROM", "onboarding@resend.dev");

// SMTP Config (Fallback/Alternative)
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

const SMTP_FROM = getEnv(
  "MAIL_FROM",
  `EagleNet Logistics <no-reply@${getEnv("MAIL_FROM_DOMAIN", "example.com")}>`,
);

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function send(payload: EmailPayload) {
  if (!ENABLED) {
    console.info(
      `[EmailService] Mailing disabled. Would send: ${payload.subject} → ${payload.to}`,
    );
    return;
  }

  if (PROVIDER === "console") {
    console.info("============== EMAIL LOG ==============");
    console.info(`To:      ${payload.to}`);
    console.info(`Subject: ${payload.subject}`);
    console.info("---------------- HTML -----------------");
    console.info(payload.html.substring(0, 200) + "...");
    console.info("=======================================");
    return;
  }

  if (PROVIDER === "smtp" && smtpTransporter) {
    try {
      await smtpTransporter.sendMail({
        from: SMTP_FROM,
        ...payload,
      });
      return;
    } catch (err) {
      console.error("[EmailService] SMTP Send failed:", err);
    }
  }

  // Default: Resend
  try {
    // If using Resend without a verified domain, 'from' must be 'onboarding@resend.dev'
    // and 'to' must be the registered owner email.
    await resend.emails.send({
      from: RESEND_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  } catch (err) {
    console.error("[EmailService] Resend failed:", err);

    // Auto-fallback to console in dev if Resend fails
    if (process.env.NODE_ENV !== "production") {
      console.warn("[EmailService] Falling back to console log due to error.");
      console.info(`[FALLBACK] To: ${payload.to} | Sub: ${payload.subject}`);
    }
  }
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
    .badge-delivered { background: #d4edda; color: #155724; }
    .badge-delay { background: #f8d7da; color: #721c24; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-failed { background: #f8d7da; color: #721c24; }
    .btn { display: inline-block; margin: 20px 0; padding: 12px 28px; background: #e8a835; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
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

export async function sendWelcomeEmail(to: string, firstName: string) {
  await send({
    to,
    subject: `Welcome to ${BRAND}! 🎉`,
    html: base(`
      <h2>Welcome, ${firstName}! 🎉</h2>
      <p>Thank you for joining <strong>${BRAND}</strong>. We're excited to have you on board.</p>
      <p>You can now log in and start booking your shipments with ease.</p>
      <p>If you have any questions, don't hesitate to reach out to our support team.</p>`),
  });
}

export async function sendBookingConfirmationEmail(
  to: string,
  data: {
    fullName: string;
    shippingId: string;
    trackingId: string;
    pickupCity: string;
    destinationCity: string;
    preferredPickupDate: string;
    amount: string | number;
  },
) {
  await send({
    to,
    subject: `Booking Confirmed – ${data.shippingId}`,
    html: base(`
      <h2>Booking Confirmed ✅</h2>
      <p>Hi <strong>${data.fullName}</strong>, your shipment has been booked successfully.</p>
      <table class="info-table">
        <tr><td>Shipping ID</td><td>${data.shippingId}</td></tr>
        <tr><td>Tracking ID</td><td>${data.trackingId}</td></tr>
        <tr><td>From</td><td>${data.pickupCity}</td></tr>
        <tr><td>To</td><td>${data.destinationCity}</td></tr>
        <tr><td>Pickup Date</td><td>${data.preferredPickupDate}</td></tr>
        <tr><td>Amount</td><td>₦${Number(data.amount).toLocaleString()}</td></tr>
      </table>
      <p>You will receive further updates as your shipment progresses.</p>`),
  });
}

export async function sendStatusUpdateEmail(
  to: string,
  data: {
    fullName: string;
    trackingId: string;
    status: string;
    pickupCity: string;
    destinationCity: string;
  },
) {
  const statusMap: Record<string, string> = {
    PENDING: "badge-pending",
    TRANSIT: "badge-transit",
    DELIVERED: "badge-delivered",
    DELAY: "badge-delay",
  };
  await send({
    to,
    subject: `Shipment Update – ${data.trackingId}`,
    html: base(`
      <h2>Shipment Status Update 📦</h2>
      <p>Hi <strong>${data.fullName}</strong>, here's an update on your shipment.</p>
      <table class="info-table">
        <tr><td>Tracking ID</td><td>${data.trackingId}</td></tr>
        <tr><td>Route</td><td>${data.pickupCity} → ${data.destinationCity}</td></tr>
        <tr><td>New Status</td><td><span class="badge ${statusMap[data.status] || ""}">${data.status}</span></td></tr>
      </table>`),
  });
}

export async function sendPaymentConfirmationEmail(
  to: string,
  data: {
    fullName: string;
    paymentId: string;
    reference: string;
    amount: string | number;
    status: string;
    shippingId?: string;
  },
) {
  await send({
    to,
    subject: `Payment ${data.status === "SUCCESS" ? "Confirmed" : "Update"} – ${data.paymentId}`,
    html: base(`
      <h2>Payment ${data.status === "SUCCESS" ? "Successful ✅" : "Update"}</h2>
      <p>Hi <strong>${data.fullName}</strong>, here are your payment details.</p>
      <table class="info-table">
        <tr><td>Payment ID</td><td>${data.paymentId}</td></tr>
        <tr><td>Reference</td><td>${data.reference}</td></tr>
        <tr><td>Amount</td><td>₦${Number(data.amount).toLocaleString()}</td></tr>
        ${data.shippingId ? `<tr><td>Shipping ID</td><td>${data.shippingId}</td></tr>` : ""}
        <tr><td>Status</td><td><span class="badge badge-${data.status.toLowerCase()}">${data.status}</span></td></tr>
      </table>`),
  });
}

export async function sendAdminCreatedEmail(
  to: string,
  firstName: string,
  tempPassword?: string,
) {
  await send({
    to,
    subject: `You've been granted Admin access – ${BRAND}`,
    html: base(`
      <h2>Admin Access Granted 🛡️</h2>
      <p>Hi <strong>${firstName}</strong>, you have been assigned the <strong>Admin</strong> role on ${BRAND}.</p>
      ${tempPassword ? `<p>Your temporary password is: <strong>${tempPassword}</strong>. Please change it after logging in.</p>` : ""}
      <p>You now have access to the admin dashboard.</p>`),
  });
}

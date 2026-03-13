import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import { Resend } from "resend";

type Provider = "smtp" | "sendgrid" | "resend" | "console";

interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

// Helper to clean env variables
const getEnv = (key: string, fallback: string = ""): string => {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split("#")[0].trim();
};

export class MailService {
  private provider: Provider;
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private mailingEnabled: boolean = true;

  constructor() {
    this.provider = getEnv("MAIL_PROVIDER", "console") as Provider;

    // Global switch: set MAILING_ENABLED=0 to disable sending emails (useful on hosting without SMTP)
    this.mailingEnabled = getEnv("MAILING_ENABLED", "1") === "1";

    // Register partials/helpers regardless of provider so templates compile in dev
    this.registerPartials();
    this.registerHelpers();

    if (this.provider === "sendgrid") {
      const key = process.env.SENDGRID_API_KEY;
      if (!key)
        throw new Error("SENDGRID_API_KEY is required for sendgrid provider");
      sgMail.setApiKey(key);
    }

    if (this.provider === "resend") {
      const key = process.env.RESEND_API_KEY;
      if (!key)
        throw new Error("RESEND_API_KEY is required for resend provider");
      this.resend = new Resend(key);
    }

    if (this.provider === "smtp") {
      const smtpUser = getEnv("SMTP_USER");
      const smtpPass = getEnv("SMTP_PASS");
      const smtpHost = getEnv("SMTP_HOST", "smtp.gmail.com");
      const smtpPort = parseInt(getEnv("SMTP_PORT", "587"), 10);
      const smtpSecure = getEnv("SMTP_SECURE", "false") === "true";

      if (!smtpUser || !smtpPass)
        throw new Error(
          "SMTP_USER and SMTP_PASS are required for smtp provider",
        );

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        pool: true,
      });
    }
  }

  private registerHelpers() {
    Handlebars.registerHelper("formatDate", (date: any) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleString();
    });

    Handlebars.registerHelper("asset", (key: string) => {
      if (key === "logo") return process.env.MAIL_BRAND_LOGO_URL || "";
      return "";
    });
  }

  private registerPartials() {
    try {
      const partialsDir = path.join(
        process.cwd(),
        "src",
        "templates",
        "emails",
        "partials",
      );
      if (!fs.existsSync(partialsDir)) return;
      const files = fs.readdirSync(partialsDir);
      for (const f of files) {
        if (!f.endsWith(".hbs")) continue;
        const name = path.basename(f, ".hbs");
        const content = fs.readFileSync(path.join(partialsDir, f), "utf8");
        Handlebars.registerPartial(name, content);
      }
    } catch (err) {
      console.warn("Failed to register email partials", err);
    }
  }

  private loadTemplate(name: string) {
    if (this.templates.has(name)) return this.templates.get(name)!;

    const filePath = path.join(
      process.cwd(),
      "src",
      "templates",
      "emails",
      `${name}.hbs`,
    );
    if (!fs.existsSync(filePath))
      throw new Error(`Template not found: ${name}`);

    const content = fs.readFileSync(filePath, "utf8");
    const compiled = Handlebars.compile(content);
    this.templates.set(name, compiled);
    return compiled;
  }

  async sendMail(opts: MailOptions) {
    const from =
      opts.from ||
      getEnv("MAIL_FROM") ||
      `no-reply@${getEnv("MAIL_FROM_DOMAIN", "example.com")}`;

    if (!this.mailingEnabled) {
      console.info(
        "[MailService] Mailing disabled by MAILING_ENABLED=0 - skipping send",
        { to: opts.to, subject: opts.subject },
      );
      return;
    }

    if (this.provider === "console") {
      console.info("[MailService] Sending mail (console provider)", {
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return;
    }

    if (this.provider === "sendgrid") {
      await sgMail.send({
        to: opts.to,
        from,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      } as any);
      return;
    }

    if (this.provider === "resend") {
      if (!this.resend) throw new Error("Resend not initialized");
      await this.resend.emails.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html || "",
        ...(opts.text ? { text: opts.text } : {}),
      } as any);
      return;
    }

    if (this.provider === "smtp") {
      if (!this.transporter)
        throw new Error("SMTP transporter not initialized");

      await this.transporter.sendMail({
        to: opts.to,
        from,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return;
    }

    throw new Error("Mail provider not supported");
  }

  async sendTemplate(
    to: string,
    subject: string,
    templateName: string,
    context: any = {},
  ) {
    if (!this.mailingEnabled) {
      console.info(
        "[MailService] Mailing disabled by MAILING_ENABLED=0 - skipping sendTemplate",
        { to, subject, templateName },
      );
      return;
    }

    const tpl = this.loadTemplate(templateName);

    const merged = {
      subject,
      preheader:
        context.preheader ||
        (context.body
          ? context.body.replace(/(<([^>]+)>|\n)/g, " ") || ""
          : ""),
      brandName: process.env.MAIL_BRAND_NAME || "TBG",
      brandUrl: process.env.MAIL_BRAND_URL || "example.com",
      logoUrl: process.env.MAIL_BRAND_LOGO_URL || "",
      unsubscribe_url: process.env.MAIL_UNSUBSCRIBE_URL || "",
      unsubscribe_message:
        context.unsubscribe_message ||
        `To manage your email preferences, visit your account settings or <a href=\"${process.env.MAIL_UNSUBSCRIBE_URL || "#"}\">unsubscribe</a>.`,
      year: context.year || new Date().getFullYear(),
      ...context,
    };

    const html = tpl(merged);
    const text = this.stripHtml(html);

    return this.sendMail({ to, subject, html, text });
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, "");
  }
}

// Export a singleton
export const mailService = new MailService();

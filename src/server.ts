import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import path from "path";
import rateLimit from "express-rate-limit";
import { AppDataSource } from "../database/data-source";
import { initSocket } from "./socket";
import { randomUUID } from "crypto";
import winston from "winston";
import multer from "multer";

import { startKeepAliveJob } from "./jobs/keepAlive";

// ── Routes ────────────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import shipmentRoutes from "./routes/shipment.routes";
import paymentRoutes from "./routes/payment.routes";
import adminRoutes from "./routes/admin.routes";

// Load environment variables
dotenv.config();

// initialize express
const app = express();

// Start Background Jobs
if (
  process.env.NODE_ENV === "production" ||
  process.env.ENABLE_CRON === "true"
) {
  startKeepAliveJob();
}

// Trust the first proxy (Render)
app.set("trust proxy", 1);

// Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

// Strict auth limiter (brute-force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

// Public file limiter
const publicFileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many file requests.",
});
app.use("/public", publicFileLimiter);

app.use(hpp() as any);

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));

// Request ID + structured logging
app.use((req, res, next) => {
  const reqId = (req as any).id || randomUUID();
  (req as any).id = reqId;
  res.setHeader("X-Request-Id", reqId);
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      msg: "http_request",
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      requestId: reqId,
      ip: req.ip,
    });
  });
  next();
});

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
// NOTE: Paystack webhook route uses raw body (handled inside payment.routes.ts)
//       so the global json parser must come AFTER we register the webhook route.
//       We mount the webhook first, then apply json().
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10kb" }));

// ─── STATIC ───────────────────────────────────────────────────────────────────
app.use("/public", express.static(path.join(process.cwd(), "public")));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  return res.status(200).json({
    status: "success",
    message: "EagleNet Logistics API is running",
    version: "1.0.0",
    timestamp: new Date(),
  });
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  return res.status(404).json({ status: "error", message: "Route not found." });
});

// ─── MULTER ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ status: "error", message: err.message });
  }
  return next(err);
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("UNHANDLED ERROR", { message: err?.message, stack: err?.stack });
  return res.status(err.statusCode || 500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

// ─── SERVER STARTUP ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
initSocket(httpServer);

AppDataSource.initialize()
  .then(() => {
    logger.info("Data Source has been initialized!");
    httpServer.listen(PORT, () => {
      logger.info(`EagleNet API running on port ${PORT}`, { port: PORT });
    });
  })
  .catch((err: any) => {
    logger.error("Error during Data Source initialization", {
      message: err?.message,
      stack: err?.stack,
    });
  });

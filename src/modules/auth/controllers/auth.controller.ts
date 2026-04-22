import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AppDataSource } from "../../../../database/data-source";
import { User, UserRole } from "../../users/entities/User";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";
import { serializeUser } from "../../../utils/serializers";

const userRepo = () => AppDataSource.getRepository(User);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = (process.env.JWT_EXPIRES_IN || "30d") as any;
  return jwt.sign({ id: userId }, secret, { expiresIn });
}


async function assignTokens(user: User) {
  const token = signToken(user.id);
  const rawRefreshToken = crypto.randomBytes(32).toString("hex");
  const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

  user.refreshToken = hashedRefreshToken;
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await userRepo().save(user);
  return { token, refreshToken: rawRefreshToken };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "All fields are required." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ status: "error", message: "Password must be at least 6 characters." });
    }

    const repo = userRepo();

    const exists = await repo.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (exists) {
      return res
        .status(409)
        .json({ status: "error", message: "Email already registered." });
    }

    // First user → SUPERADMIN
    const count = await repo.count();
    const role = count === 0 ? UserRole.SUPERADMIN : UserRole.STAFF;

    const hashed = await bcrypt.hash(password, 12);

    const user = repo.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role,
    });

    await repo.save(user);

    const tokens = await assignTokens(user);

    createAuditLog({
      entityType: "User",
      entityId: user.id,
      action: AuditAction.CREATE,
      actionDetails: { email: user.email, role: user.role },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).status(201).success(
      {
        ...tokens,
        user: serializeUser(user),
      },
      "Registration successful."
    );
  } catch (err: any) {
    console.error("[AuthController.register]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "Email and password are required." });
    }

    const repo = userRepo();
    const user = await repo.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      // Log failed attempt (no userId since user may not exist)
      createAuditLog({
        entityType: "User",
        action: AuditAction.LOGIN_FAILED,
        actionDetails: { attemptedEmail: email.toLowerCase().trim() },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      createAuditLog({
        entityType: "User",
        entityId: user.id,
        action: AuditAction.LOGIN_FAILED,
        actionDetails: { reason: "incorrect_password" },
        performedBy: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials." });
    }

    // Update last login info
    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    await repo.save(user);

    const tokens = await assignTokens(user);

    createAuditLog({
      entityType: "User",
      entityId: user.id,
      action: AuditAction.LOGIN,
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(
      {
        ...tokens,
        user: serializeUser(user),
      },
      "Login successful."
    );
  } catch (err: any) {
    console.error("[AuthController.login]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Get current user profile ──────────────────────────────────────────────

export async function me(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    return (res as any).success(serializeUser(user));
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Refresh Token ─────────────────────────────────────────────────────────

export async function refresh(req: Request, res: Response) {
  try {
    const { token, refreshToken } = req.body;

    if (!token || !refreshToken) {
      return res.status(400).json({ status: "error", message: "Both access token and refresh token are required." });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!, { ignoreExpiration: true });
    } catch (e) {
      return res.status(401).json({ status: "error", message: "Invalid access token." });
    }

    const repo = userRepo();
    const user = await repo.findOne({ where: { id: payload.id } });

    if (!user || !user.refreshToken || !user.refreshTokenExpiresAt) {
      return res.status(401).json({ status: "error", message: "Invalid refresh token." });
    }

    if (new Date() > user.refreshTokenExpiresAt) {
      return res.status(401).json({ status: "error", message: "Refresh token expired. Please login again." });
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) {
      return res.status(401).json({ status: "error", message: "Invalid refresh token." });
    }

    const tokens = await assignTokens(user);

    return (res as any).success(tokens);
  } catch (err) {
    console.error("[AuthController.refresh]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const repo = userRepo();

    user.refreshToken = undefined;
    user.refreshTokenExpiresAt = undefined;
    await repo.save(user);

    createAuditLog({
      entityType: "User",
      entityId: user.id,
      action: AuditAction.LOGOUT,
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "Logged out successfully.");
  } catch (err) {
    console.error("[AuthController.logout]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── Change Password ────────────────────────────────────────────────────────

export async function changePassword(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: "error", message: "Both current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ status: "error", message: "New password must be at least 6 characters." });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ status: "error", message: "Current password is incorrect." });
    }

    const repo = userRepo();
    user.password = await bcrypt.hash(newPassword, 12);
    // Invalidate all refresh tokens on password change (force re-login)
    user.refreshToken = undefined;
    user.refreshTokenExpiresAt = undefined;
    await repo.save(user);

    createAuditLog({
      entityType: "User",
      entityId: user.id,
      action: AuditAction.PASSWORD_CHANGE,
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "Password changed successfully. Please login again.");
  } catch (err) {
    console.error("[AuthController.changePassword]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

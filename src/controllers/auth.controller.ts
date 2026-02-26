import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../database/data-source";
import { User, UserRole } from "../entities/User";
import { sendWelcomeEmail } from "../services/email.service";

const userRepo = () => AppDataSource.getRepository(User);

// ─── Register ────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "All fields are required." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Password must be at least 6 characters.",
        });
    }

    const repo = userRepo();

    // Check duplicate
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
    const role = count === 0 ? UserRole.SUPERADMIN : UserRole.CUSTOMER;

    const hashed = await bcrypt.hash(password, 12);

    const user = repo.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role,
    });

    await repo.save(user);

    // Fire-and-forget welcome email
    sendWelcomeEmail(user.email, user.firstName).catch(console.error);

    const token = signToken(user.id);

    return res.status(201).json({
      status: "success",
      message: "Registration successful.",
      data: {
        token,
        user: sanitize(user),
      },
    });
  } catch (err: any) {
    console.error("[AuthController.register]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

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
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials." });
    }

    const token = signToken(user.id);

    return res.status(200).json({
      status: "success",
      message: "Login successful.",
      data: {
        token,
        user: sanitize(user),
      },
    });
  } catch (err: any) {
    console.error("[AuthController.login]", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Get current user profile ────────────────────────────────────────────────

export async function me(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    return res.status(200).json({ status: "success", data: sanitize(user) });
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = (process.env.JWT_EXPIRES_IN || "30d") as any;
  return jwt.sign({ id: userId }, secret, { expiresIn });
}

function sanitize(user: User) {
  const { password, ...rest } = user as any;
  return rest;
}

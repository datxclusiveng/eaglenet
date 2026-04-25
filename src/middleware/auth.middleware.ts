import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../database/data-source";
import { User, UserRole } from "../modules/users/entities/User";

export interface AuthRequest extends Request {
  user?: User;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ status: "error", message: "Authentication required." });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as { id: string, tokenVersion?: number };
    // Attach minimal user info; controllers can fetch full record from DB when needed
    (req as any).userId = decoded.id;
    (req as any).tokenVersion = decoded.tokenVersion || 0;
    next();
  } catch {
    res
      .status(401)
      .json({ status: "error", message: "Invalid or expired token." });
    return;
  }
}

/**
 * Middleware factory – loads user from DB and attaches to req.user
 */
export function loadUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const id = (req as any).userId;
  if (!id) {
    res.status(401).json({ status: "error", message: "Not authenticated." });
    return;
  }

  AppDataSource.getRepository(User)
    .findOne({ where: { id, isActive: true } })
    .then((user) => {
      if (!user) {
        res
          .status(401)
          .json({ status: "error", message: "User not found or inactive." });
        return;
      }
      
      const tokenVersion = (req as any).tokenVersion || 0;
      if (user.tokenVersion !== tokenVersion) {
        res
          .status(401)
          .json({ status: "error", message: "Token has been revoked. Please login again." });
        return;
      }

      req.user = user;
      next();
    })
    .catch(next);
}

/**
 * Role guard factory
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ status: "error", message: "Not authenticated." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res
        .status(403)
        .json({
          status: "error",
          message: "Forbidden: insufficient permissions.",
        });
      return;
    }
    next();
  };
}

/** Combined: authenticate + load user */
export const auth = [authenticate, loadUser];

/** Only superadmin */
export const superAdminOnly = [
  authenticate,
  loadUser,
  requireRole(UserRole.SUPERADMIN),
];

/** Superadmin or admin */
export const adminOnly = [
  authenticate,
  loadUser,
  requireRole(UserRole.SUPERADMIN, UserRole.ADMIN),
];

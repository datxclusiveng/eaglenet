import { Router } from "express";
import { register, login, me, refresh, logout, logoutAll, changePassword, forgotPassword, resetPassword, getPermissions } from "../controllers/auth.controller";
import { auth } from "../../../middleware/auth.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { registerSchema, loginSchema } from "../../../utils/validators";

const router = Router();

/**
 * POST /api/auth/register
 * Body: { firstName, lastName, email, password }
 */
router.post("/register", validate(registerSchema), register);

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", validate(loginSchema), login);

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
router.post("/forgot-password", forgotPassword);

/**
 * POST /api/auth/reset-password
 * Body: { email, code, newPassword }
 */
router.post("/reset-password", resetPassword);

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile
 */
router.get("/me", ...auth, me);

/**
 * POST /api/auth/refresh
 * Body: { token, refreshToken }
 */
router.post("/refresh", refresh);

/**
 * POST /api/auth/logout
 */
router.post("/logout", ...auth, logout);

/**
 * POST /api/auth/logout-all
 * Logs out from all devices by invalidating all JWTs
 */
router.post("/logout-all", ...auth, logoutAll);

/**
 * PATCH /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * Invalidates all existing sessions on success.
 */
router.patch("/change-password", ...auth, changePassword);

/**
 * GET /api/auth/permissions
 * Returns the full permission map for the authenticated user.
 * Use this to refresh permissions after role changes without a full re-login.
 */
router.get("/permissions", ...auth, getPermissions);

export default router;

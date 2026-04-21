import { Router } from "express";
import { register, login, me, refresh, logout, changePassword } from "../controllers/auth.controller";
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
 * PATCH /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * Invalidates all existing sessions on success.
 */
router.patch("/change-password", ...auth, changePassword);

export default router;

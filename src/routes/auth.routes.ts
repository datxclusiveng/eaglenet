import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller";
import { auth } from "../middleware/auth.middleware";

const router = Router();

/**
 * POST /api/auth/register
 * Body: { firstName, lastName, email, password }
 */
router.post("/register", register);

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", login);

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile
 */
router.get("/me", ...auth, me);

export default router;

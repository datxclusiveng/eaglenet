import { Router } from "express";
import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/department.controller";
import { auth, adminOnly } from "../../../middleware/auth.middleware";

const router = Router();

// Routes for managing dynamic departments.
// Mostly restricted to Admins/Superadmins during regular operation.

router.get("/", ...auth, listDepartments);
router.get("/:id", ...auth, getDepartment);

// Elevated administrative routes
router.post("/", ...adminOnly, createDepartment);
router.patch("/:id", ...adminOnly, updateDepartment);
router.delete("/:id", ...adminOnly, deleteDepartment);

export default router;

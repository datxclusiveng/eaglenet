import { Router } from "express";
import {
  listServices,
  createService,
  updateService,
  deleteService,
} from "../controllers/service.controller";
import { adminOnly } from "../../../middleware/auth.middleware";

const router = Router();

// Public/User
router.get("/", listServices);

// Admin Only
router.post("/", ...adminOnly, createService);
router.patch("/:id", ...adminOnly, updateService);
router.delete("/:id", ...adminOnly, deleteService);

export default router;

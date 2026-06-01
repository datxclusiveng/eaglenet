import { Router } from "express";
import {
  createWarehouseEntryHandler,
  listWarehouseEntriesHandler,
  getWarehouseEntryHandler,
  updateWarehouseEntryHandler,
  deleteWarehouseEntryHandler,
  listMyWarehouseHandler,
} from "../controllers/warehouse.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { createWarehouseEntrySchema, updateWarehouseEntrySchema, uuidParamSchema } from "../../../utils/validators";

const router = Router();

/**
 * POST /api/warehouse
 * Create a new warehouse entry (inbound or outbound)
 */
router.post("/", ...auth, authorize("warehouse", "create"), validate(createWarehouseEntrySchema), createWarehouseEntryHandler);

/**
 * GET /api/warehouse/my
 * List own warehouse entries (paginated, filterable)
 * NOTE: Must be registered before /:id to prevent "my" being treated as an ID
 */
router.get("/my", ...auth, listMyWarehouseHandler);

/**
 * GET /api/warehouse
 * List all warehouse entries (paginated, filterable)
 * Query: ?page&limit&direction&clients&awb&startDateIn&endDateIn&startDateOut&endDateOut
 */
router.get("/", ...auth, authorize("warehouse", "read"), listWarehouseEntriesHandler);

/**
 * GET /api/warehouse/:id
 * Get a single warehouse entry by ID
 */
router.get("/:id", ...auth, authorize("warehouse", "read"), validate(uuidParamSchema), getWarehouseEntryHandler);

/**
 * PATCH /api/warehouse/:id
 * Update a warehouse entry
 */
router.patch("/:id", ...auth, authorize("warehouse", "update"), validate(updateWarehouseEntrySchema), updateWarehouseEntryHandler);

/**
 * DELETE /api/warehouse/:id
 * Soft-delete a warehouse entry
 */
router.delete("/:id", ...auth, authorize("warehouse", "delete"), validate(uuidParamSchema), deleteWarehouseEntryHandler);

export default router;

import { Router } from "express";
import {
  createCashbookEntryHandler,
  listCashbookEntriesHandler,
  getCashbookEntryHandler,
  updateCashbookEntryHandler,
  deleteCashbookEntryHandler,
  listMyCashbookHandler,
} from "../controllers/cashbook.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import {
  createCashbookEntrySchema,
  updateCashbookEntrySchema,
  uuidParamSchema,
} from "../../../utils/validators";

const router = Router();

router.post(
  "/",
  ...auth,
  authorize("cashbook", "create"),
  validate(createCashbookEntrySchema),
  createCashbookEntryHandler
);

router.get(
  "/my",
  ...auth,
  listMyCashbookHandler
);

router.get(
  "/",
  ...auth,
  authorize("cashbook", "read"),
  listCashbookEntriesHandler
);

router.get(
  "/:id",
  ...auth,
  authorize("cashbook", "read"),
  validate(uuidParamSchema),
  getCashbookEntryHandler
);

router.patch(
  "/:id",
  ...auth,
  authorize("cashbook", "update"),
  validate(updateCashbookEntrySchema),
  updateCashbookEntryHandler
);

router.delete(
  "/:id",
  ...auth,
  authorize("cashbook", "delete"),
  validate(uuidParamSchema),
  deleteCashbookEntryHandler
);

export default router;

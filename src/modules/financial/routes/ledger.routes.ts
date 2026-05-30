import { Router } from "express";
import {
  createLedgerEntryHandler,
  listLedgerEntriesHandler,
  getLedgerEntryHandler,
  updateLedgerEntryHandler,
  deleteLedgerEntryHandler,
  listMyLedgerHandler,
} from "../controllers/ledger.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import {
  createLedgerEntrySchema,
  updateLedgerEntrySchema,
  uuidParamSchema,
} from "../../../utils/validators";

const router = Router();

router.post(
  "/",
  ...auth,
  authorize("ledger", "create"),
  validate(createLedgerEntrySchema),
  createLedgerEntryHandler
);

router.get(
  "/my",
  ...auth,
  listMyLedgerHandler
);

router.get(
  "/",
  ...auth,
  authorize("ledger", "read"),
  listLedgerEntriesHandler
);

router.get(
  "/:id",
  ...auth,
  authorize("ledger", "read"),
  validate(uuidParamSchema),
  getLedgerEntryHandler
);

router.patch(
  "/:id",
  ...auth,
  authorize("ledger", "update"),
  validate(updateLedgerEntrySchema),
  updateLedgerEntryHandler
);

router.delete(
  "/:id",
  ...auth,
  authorize("ledger", "delete"),
  validate(uuidParamSchema),
  deleteLedgerEntryHandler
);

export default router;

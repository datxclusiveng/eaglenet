import { Router } from "express";
import {
  createBankAccountHandler,
  listBankAccountsHandler,
  getBankAccountHandler,
  updateBankAccountHandler,
  deleteBankAccountHandler,
  setDefaultBankAccountHandler,
} from "../controllers/bank-account.controller";
import { adminOnly } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { createBankAccountSchema, updateBankAccountSchema } from "../../../utils/validators";

const router = Router();

router.post(
  "/",
  ...adminOnly,
  authorize("invoice", "update"),
  validate(createBankAccountSchema),
  createBankAccountHandler
);

router.get(
  "/",
  ...adminOnly,
  authorize("invoice", "read"),
  listBankAccountsHandler
);

router.get(
  "/:id",
  ...adminOnly,
  authorize("invoice", "read"),
  getBankAccountHandler
);

router.patch(
  "/:id",
  ...adminOnly,
  authorize("invoice", "update"),
  validate(updateBankAccountSchema),
  updateBankAccountHandler
);

router.delete(
  "/:id",
  ...adminOnly,
  authorize("invoice", "update"),
  deleteBankAccountHandler
);

router.patch(
  "/:id/set-default",
  ...adminOnly,
  authorize("invoice", "update"),
  setDefaultBankAccountHandler
);

export default router;

import { Router } from "express";
import { 
  listCustomers, 
  createCustomer, 
  getCustomerShipments 
} from "../controllers/customer.controller";
import { auth } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/authorize.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { z } from "zod";

const router = Router();

// Validation Schemas
const createCustomerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name is required."),
    email: z.string().email("Invalid email address."),
    phoneNumber: z.string().min(5, "Valid phone number is required.")
  })
});

/**
 * GET /api/customers
 * List & Search
 */
router.get("/", ...auth, authorize("customer", "read"), listCustomers);

/**
 * POST /api/customers
 * Create new customer
 */
router.post("/", ...auth, authorize("customer", "create"), validate(createCustomerSchema), createCustomer);

/**
 * GET /api/customers/:id/shipments
 * Intel: History by email
 */
router.get("/:id/shipments", ...auth, authorize("customer", "read"), getCustomerShipments);

export default router;

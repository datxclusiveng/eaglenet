import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const createShipmentSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email format"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    pickupAddress: z.string().min(1, "Pickup address is required"),
    pickupCity: z.string().min(1, "Pickup city is required"),
    deliveryAddress: z.string().min(1, "Delivery address is required"),
    destinationCity: z.string().min(1, "Destination city is required"),
    preferredPickupDate: z.string().min(1, "Date is required"),
    preferredPickupTime: z.string().min(1, "Time is required"),
    weight: z.number().optional(),
    specialRequirements: z.string().optional(),
    packageDetails: z.string().optional(),
    serviceId: z.string().uuid("Invalid service ID").optional(),
    departmentId: z.string().uuid("Invalid department ID").optional(),
    creationSource: z.enum(["CUSTOMER", "STAFF"]).optional(),
    isExternal: z.boolean().optional(),
  }),
});

// For document upload, the body might contain metadata, while files are handled by multer.
export const uploadDocumentSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Document name is required"),
    documentType: z.string().min(1, "Document type is required"),
    shipmentId: z.string().uuid("Invalid shipment ID").optional(),
    isArchived: z.boolean().optional().default(false),
    visibilityScope: z.enum(["GLOBAL", "DEPARTMENT", "PRIVATE"]).optional().default("GLOBAL"),
    adminTags: z.array(z.string()).optional(),
    commitMessage: z.string().optional(),
  }),
});

export const createInvoiceSchema = z.object({
  body: z.object({
    amount: z.number().positive("Amount must be positive"),
    tax: z.number().min(0).optional(),
    shipmentId: z.string().uuid("Invalid shipment ID").optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateInvoiceStatusSchema = z.object({
  body: z.object({
    status: z.enum(["DRAFT", "SENT", "PAID", "PARTIAL", "CANCELLED"] as const, {
      message: "Invalid status value",
    }),
  }),
});

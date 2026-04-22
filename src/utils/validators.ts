import { z } from "zod";
import { InvoiceStatus } from "../modules/financial/entities/Invoice";

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
    creationSource: z.enum(["INTERNAL", "STAFF"]).optional(),
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
    shipmentId: z.string().uuid("Invalid shipment ID"),
    items: z.array(z.object({
      description: z.string().min(1, "Description is required"),
      quantity: z.number().positive("Quantity must be positive"),
      price: z.number().positive("Price must be positive"),
    })).min(1, "At least one item is required"),
    taxRate: z.number().min(0).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    currency: z.string().min(3).max(3).default("NGN"),
  }),
});

export const updateInvoiceStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(InvoiceStatus, {
      message: "Invalid status value",
    }),
  }),
});

import { z } from "zod";
import { InvoiceStatus } from "../modules/financial/entities/Invoice";
import { ShipmentStatus } from "../modules/shipments/entities/Shipment";

export const updateShipmentStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ShipmentStatus),
    note: z.string().optional(),
    location: z.string().optional(),
    visibility: z.enum(["public", "internal"]).optional().default("public"),
  }),
  params: z.object({
    id: z.string().uuid("Invalid ID format."),
  }),
});

export const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid ID format. Must be a valid UUID."),
  }),
});

export const shipmentIdParamSchema = z.object({
  params: z.object({
    shipmentId: z.string().uuid("Invalid Shipment ID format."),
  }),
});

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
    shipmentName: z.string().min(1, "Shipment name is required"),
    type: z.enum(["export", "import"]),
    clientName: z.string().min(1, "Client name is required"),
    clientEmail: z.string().email("Invalid email format"),
    clientPhone: z.string().optional(),
    pickupAddress: z.string().optional(),
    deliveryAddress: z.string().optional(),
    originCountry: z.string().optional(),
    originCity: z.string().optional(),
    destinationCountry: z.string().optional(),
    destinationCity: z.string().optional(),
    weightKg: z.number().optional(),
    dimensions: z.string().optional(),
    departmentId: z.string().uuid("Invalid department ID").optional(),
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

export const processManualPaymentSchema = z.object({
  body: z.object({
    status: z.enum(["SUCCESS", "FAILED"]),
    notes: z.string().min(1, "Reason or memo is required for manual processing."),
  }),
  params: z.object({
    id: z.string().uuid("Invalid payment ID format."),
  }),
});

export const adminConfirmPaymentSchema = z.object({
  body: z.object({
    invoiceId: z.string().uuid("Invalid invoice ID."),
    amount: z.coerce.number().positive("Amount must be positive."),
    paymentMethod: z.enum(["transfer", "cash", "card"]),
    notes: z.string().min(1, "Internal notes are required for audit trail."),
    receiptUrl: z.string().optional(),
    metadata: z.preprocess((val) => {
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    }, z.record(z.string(), z.any()).optional()),
  }),
});

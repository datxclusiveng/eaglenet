import { z } from "zod";
import { InvoiceStatus } from "../modules/financial/entities/Invoice";
import { ShipmentStatus } from "../modules/shipments/entities/Shipment";
import { BankAccountType } from "../modules/financial/entities/BankAccount";
import { TransactionNature, EntryType } from "../modules/financial/entities/CashbookEntry";
import { LedgerTransactionNature, LedgerEntryType } from "../modules/financial/entities/LedgerEntry";
import { WarehouseDirection } from "../modules/warehouse/entities/WarehouseEntry";

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

export const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().uuid("Invalid User ID format."),
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

export const uploadSignatureResponseSchema = z.object({
  body: z.object({
    signatureUrl: z.string().optional(),
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
    taxRate: z.number().min(0).max(100).optional().default(0),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
    notes: z.string().optional(),
    currency: z.string().length(3).default("NGN"),
    invoiceFormat: z.enum(["naira", "foreign"]).default("naira"),
    bankAccountId: z.string().uuid("Invalid bank account ID").optional(),
    shipmentFields: z.object({
      fileNumber: z.string().optional(),
      yourRef: z.string().optional(),
      numberOfPackages: z.number().int().positive().optional(),
      grossWeight: z.number().positive().optional(),
      chargeableWeight: z.number().positive().optional(),
      cubit: z.number().positive().optional(),
      awbBlNumber: z.string().optional(),
      jobDescription: z.string().optional(),
    }).optional(),
  }),
});

export const updateInvoiceSchema = z.object({
  body: z.object({
    fileNumber: z.string().optional(),
    yourRef: z.string().optional(),
    numberOfPackages: z.number().int().positive().optional(),
    grossWeight: z.number().positive().optional(),
    chargeableWeight: z.number().positive().optional(),
    cubit: z.number().positive().optional(),
    awbBlNumber: z.string().optional(),
    jobDescription: z.string().optional(),
    items: z.array(z.object({
      description: z.string().min(1, "Description is required"),
      quantity: z.number().positive("Quantity must be positive"),
      price: z.number().positive("Price must be positive"),
    })).min(1, "At least one item is required").optional(),
    taxRate: z.number().min(0).max(100).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
    notes: z.string().optional(),
    currency: z.string().length(3).optional(),
    invoiceFormat: z.enum(["naira", "foreign"]).optional(),
    bankAccountId: z.string().uuid("Invalid bank account ID").optional(),
    clientName: z.string().optional(),
    clientEmail: z.string().email("Invalid email").optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid invoice ID"),
  }),
});

export const updateInvoiceStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(InvoiceStatus, {
      message: "Invalid status value",
    }),
  }),
});

export const rejectInvoiceSchema = z.object({
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required"),
  }),
  params: z.object({
    id: z.string().uuid("Invalid invoice ID"),
  }),
});

export const createBankAccountSchema = z.object({
  body: z.object({
    accountName: z.string().min(1, "Account name is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    bankName: z.string().min(1, "Bank name is required"),
    bankAddress: z.string().optional(),
    sortCode: z.string().optional(),
    swiftCode: z.string().optional(),
    intermediaryBank: z.string().optional(),
    intermediarySwift: z.string().optional(),
    tin: z.string().optional(),
    additionalInfo: z.string().optional(),
    currency: z.string().length(3).default("NGN"),
    accountType: z.nativeEnum(BankAccountType),
    isDefault: z.boolean().optional().default(false),
  }),
});

export const updateBankAccountSchema = z.object({
  body: z.object({
    accountName: z.string().min(1).optional(),
    accountNumber: z.string().min(1).optional(),
    bankName: z.string().min(1).optional(),
    bankAddress: z.string().optional(),
    sortCode: z.string().optional(),
    swiftCode: z.string().optional(),
    intermediaryBank: z.string().optional(),
    intermediarySwift: z.string().optional(),
    tin: z.string().optional(),
    additionalInfo: z.string().optional(),
    currency: z.string().length(3).optional(),
    accountType: z.nativeEnum(BankAccountType).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid bank account ID"),
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

export const createChannelSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Channel name is required"),
    description: z.string().optional(),
    isPrivate: z.boolean().optional().default(false),
    departmentId: z.string().uuid("Invalid department ID").optional(),
  }),
});

export const sendChannelMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Message content is required"),
    messageType: z.enum(["text", "file"]).optional().default("text"),
    attachmentUrl: z.string().optional(),
    attachmentName: z.string().optional(),
  }),
});

export const sendMailSchema = z.object({
  body: z.object({
    to: z.string().email("Valid email required."),
    subject: z.string().min(1, "Subject is required."),
    body: z.string().min(1, "Email body is required."),
  }),
});

export const reportFilterSchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    departmentId: z.string().uuid().optional(),
    type: z.string().optional(),
  }),
});

export const customerIdParamSchema = z.object({
  params: z.object({
    customerId: z.string().uuid("Invalid Customer ID format."),
  }),
});

export const unassignStaffParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Department ID format."),
    userId: z.string().uuid("Invalid User ID format."),
    roleId: z.string().uuid("Invalid Role ID format."),
  }),
});

export const createVoucherSchema = z.object({
  body: z.object({
    voucherType: z.enum(["REQUEST_FOR_CASH", "PAYMENT_AUTHORITY", "CASH_PAYMENT_VOUCHER"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    purpose: z.string().optional(),
    amount: z.coerce.number().positive("Amount must be positive"),
    totalAmount: z.coerce.number().nonnegative().optional(),
    receiptUrl: z.string().optional(),
    
    // Request for Cash fields
    staffId: z.string().uuid("Invalid Staff ID").optional(),
    staffSignatureUrl: z.string().optional(),

    // Payment Authority fields
    bankTransferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bank transfer date must be YYYY-MM-DD").optional(),
    beneficiaryName: z.string().optional(),

    // Cash Payment Voucher fields
    particulars: z.preprocess((val) => {
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    }, z.array(z.object({
      sn: z.number().int().positive(),
      particulars: z.string().min(1),
      amount: z.number().positive()
    })).optional()),
    amountInWords: z.string().optional(),
    itemsDescription: z.string().optional(),
    itemsCount: z.coerce.number().int().nonnegative().optional(),
    receivedById: z.string().uuid().optional(),
    receivedByName: z.string().optional(),
    receivedBySignatureUrl: z.string().optional(),
    issuedById: z.string().uuid().optional(),
    issuedBySignatureUrl: z.string().optional()
  })
});

export const updateVoucherStatusSchema = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().optional(),
    authorizedSignatureUrl: z.string().optional()
  }),
  params: z.object({
    id: z.string().uuid("Invalid Voucher ID format.")
  })
});

export const markVoucherAsPaidSchema = z.object({
  body: z.object({
    paymentMethod: z.string().min(1, "Payment method is required"),
    paymentReference: z.string().optional(),
    paymentNotes: z.string().optional(),
    paymentEvidenceUrl: z.string().optional(),
    paidBySignatureUrl: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid Voucher ID format."),
  }),
});

export const createCashbookEntrySchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    natureOfTransaction: z.nativeEnum(TransactionNature),
    entryType: z.nativeEnum(EntryType),
    amount: z.coerce.number().positive("Amount must be positive"),
    bankName: z.string().optional(),
    bankAccountId: z.string().uuid("Invalid bank account ID").optional(),
    description: z.string().optional(),
    voucherId: z.string().uuid("Invalid voucher ID").optional(),
  }),
});

export const updateCashbookEntrySchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
    natureOfTransaction: z.nativeEnum(TransactionNature).optional(),
    entryType: z.nativeEnum(EntryType).optional(),
    amount: z.coerce.number().positive("Amount must be positive").optional(),
    bankName: z.string().optional(),
    bankAccountId: z.string().uuid("Invalid bank account ID").optional(),
    description: z.string().optional(),
    voucherId: z.string().uuid("Invalid voucher ID").optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid cashbook entry ID"),
  }),
});

// ─── Warehouse Schemas ────────────────────────────────────────────────────────

export const createWarehouseEntrySchema = z.object({
  body: z.object({
    sn: z.string().min(1, "Serial number is required"),
    direction: z.nativeEnum(WarehouseDirection),
    clients: z.string().min(1, "Clients field is required"),
    awb: z.string().min(1, "AWB is required"),
    weight: z.coerce.number().positive("Weight must be positive").optional(),
    pkgs: z.coerce.number().int().positive("Packages must be a positive integer").optional(),
    description: z.string().optional(),
    dateIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateIn must be YYYY-MM-DD"),
    dateOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOut must be YYYY-MM-DD").optional(),
    remarks: z.string().optional(),
  }),
});

export const updateWarehouseEntrySchema = z.object({
  body: z.object({
    sn: z.string().min(1).optional(),
    direction: z.nativeEnum(WarehouseDirection).optional(),
    clients: z.string().min(1).optional(),
    awb: z.string().min(1).optional(),
    weight: z.coerce.number().positive("Weight must be positive").optional(),
    pkgs: z.coerce.number().int().positive("Packages must be a positive integer").optional(),
    description: z.string().optional(),
    dateIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateIn must be YYYY-MM-DD").optional(),
    dateOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOut must be YYYY-MM-DD").optional(),
    remarks: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid warehouse entry ID"),
  }),
});

const sanitizeString = (val: string): string => {
  return val
    .replace(/<[^>]*>/g, "")           // strip HTML tags
    .replace(/&[^;]+;/g, "")           // strip HTML entities
    .replace(/javascript\s*:/gi, "")   // strip javascript: protocol
    .replace(/\bon\w+\s*=/gi, "")      // strip inline event handlers (onerror, onclick, etc.)
    .trim();
};

const itemValueSchema = z.string()
  .max(500, "Item value must be under 500 characters")
  .transform(sanitizeString);

const ledgerItemsSchema = z.object({
  faan: itemValueSchema.optional(),
  nahco: itemValueSchema.optional(),
  sahcol: itemValueSchema.optional(),
  quarantineTreatmentStamping: itemValueSchema.optional(),
  airFreightSeaFreightCharges: itemValueSchema.optional(),
  allied: itemValueSchema.optional(),
  truckingExpenses: itemValueSchema.optional(),
  operationsExpensesLabourExpenses: itemValueSchema.optional(),
  passagesTravelsHotelFeedingAccommodation: itemValueSchema.optional(),
  maintenanceOfficeWarehouse: itemValueSchema.optional(),
  maintenanceOfOfficeTrucks: itemValueSchema.optional(),
  maintenanceOfOfficeCars: itemValueSchema.optional(),
  fuelForCars: itemValueSchema.optional(),
  dieselForTrucks: itemValueSchema.optional(),
  fuelForGeneratorServicing: itemValueSchema.optional(),
  engineOilLubricant: itemValueSchema.optional(),
  renewalRegistrationOfVehiclesPapers: itemValueSchema.optional(),
  itMaintenanceOnServerComputerAccessories: itemValueSchema.optional(),
  printingAndStationaries: itemValueSchema.optional(),
  salariesAndAllowancesBonus: itemValueSchema.optional(),
  telexTelephoneAllowanceAndPostagesTransferCharges: itemValueSchema.optional(),
  renewal: itemValueSchema.optional(),
  registrationAndSubscription: itemValueSchema.optional(),
  rent: itemValueSchema.optional(),
  localTransportGateFees: itemValueSchema.optional(),
  officeConsumables: itemValueSchema.optional(),
  rateGovernmentLevies: itemValueSchema.optional(),
  packingMaterials: itemValueSchema.optional(),
  advertisement: itemValueSchema.optional(),
  legalAndAuditFees: itemValueSchema.optional(),
  utilityExpenses: itemValueSchema.optional(),
  maintenanceOfficeEquipment: itemValueSchema.optional(),
  payeRemittance: itemValueSchema.optional(),
  vatRemittance: itemValueSchema.optional(),
  importExportClearanceAgencyFeeStoragesDemurrages: itemValueSchema.optional(),
  insuranceExpenses: itemValueSchema.optional(),
  additionToFixAsset: itemValueSchema.optional(),
  staffPensionRemittance: itemValueSchema.optional(),
  nsitf: itemValueSchema.optional(),
  citEducationTax: itemValueSchema.optional(),
  staffCostTraining: itemValueSchema.optional(),
  chargesSundry: itemValueSchema.optional(),
  staffLoan: itemValueSchema.optional(),
  businessProspectingExpenses: itemValueSchema.optional(),
  damagesBusinessLosses: itemValueSchema.optional(),
  interestOnLoan: itemValueSchema.optional(),
  loanRepayment: itemValueSchema.optional(),
  entertainmentExpenses: itemValueSchema.optional(),
  medicalExpenses: itemValueSchema.optional(),
  whtTax: itemValueSchema.optional(),
  disposalExpenses: itemValueSchema.optional(),
  officeSiteClearingExpensesDevelopment: itemValueSchema.optional(),
  securityExpenses: itemValueSchema.optional(),
  officeFenceArchDesignExpenses: itemValueSchema.optional(),
  healthSafetyExpenses: itemValueSchema.optional(),
  contraEntry: itemValueSchema.optional(),
  giftsDonations: itemValueSchema.optional(),
  sponsorshipFootDevelopment: itemValueSchema.optional(),
  loanGranted: itemValueSchema.optional(),
  penalty: itemValueSchema.optional(),
  internalTransfer: itemValueSchema.optional(),
}).optional();

export const createLedgerEntrySchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    description: z.string().optional(),
    amount: z.coerce.number().positive("Amount must be positive"),
    cashReceivedFromBank: z.coerce.number().nonnegative().optional(),
    natureOfTransaction: z.nativeEnum(LedgerTransactionNature),
    entryType: z.nativeEnum(LedgerEntryType),
    items: ledgerItemsSchema,
  }),
});

export const updateLedgerEntrySchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
    description: z.string().optional(),
    amount: z.coerce.number().positive("Amount must be positive").optional(),
    cashReceivedFromBank: z.coerce.number().nonnegative().optional(),
    natureOfTransaction: z.nativeEnum(LedgerTransactionNature).optional(),
    entryType: z.nativeEnum(LedgerEntryType).optional(),
    items: ledgerItemsSchema,
  }),
  params: z.object({
    id: z.string().uuid("Invalid ledger entry ID"),
  }),
});

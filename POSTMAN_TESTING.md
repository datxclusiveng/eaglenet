# Postman Testing Guide: Finance Vouchers (API Documentation)

This guide documents how to set up, authenticate, and test the **Finance Vouchers** module (*Request for Cash*, *Authority of Payment Voucher*, and *Cash Payment Voucher*) using Postman.

---

## 1. Authentication Setup

All voucher endpoints are secure and require a bearer token. Follow these steps to authenticate in Postman:

1. **Get Token**: Send a `POST` request to `/api/auth/login` (or register first if needed).
2. **Authorize Requests**:
   - In Postman, select your folder or request.
   - Go to the **Authorization** tab.
   - Set **Type** to `Bearer Token`.
   - Paste the `token` received from the login response.

---

## 2. API Endpoints Reference

### User Signature Profile Settings

#### Set Pre-configured Profile Signature (`PATCH /api/users/me/signature`)
Allows any staff member, supervisor, or manager to upload and pre-configure their digital signature once. The signature is safely linked to their profile in the database and is automatically used as a fallback fallback during creation and approvals across the board.

* **URL**: `{{baseUrl}}/api/users/me/signature`
* **Method**: `PATCH`
* **Headers**: `Authorization: Bearer <token>`
* **Body Type**: `form-data`

| Key | Type | Value / Description | Required |
| :--- | :--- | :--- | :--- |
| `signature` | File | Choose an image file of your signature (.png, .jpg) | Yes |

##### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Signature uploaded successfully.",
  "data": {
    "signatureUrl": "https://eaglenet-s3.s3.amazonaws.com/signatures/1779966123-user-sig.png"
  }
}
```

---

### A. Create Voucher (`POST /api/vouchers`)
Used to submit a new voucher. Since these requests support uploading physical signatures and supporting documents/receipts, you **MUST** use `form-data` (Multipart Form) for the request body.

* **URL**: `{{baseUrl}}/api/vouchers`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Body Type**: `form-data`

#### 1. Request for Cash Fields (Form-Data)
| Key | Type | Value / Description | Required |
| :--- | :--- | :--- | :--- |
| `voucherType` | Text | `REQUEST_FOR_CASH` | Yes |
| `date` | Text | `2026-05-28` (YYYY-MM-DD) | Yes |
| `purpose` | Text | For purchasing office supplies | Yes |
| `amount` | Text | `50000` | Yes |
| `totalAmount` | Text | `50000` | No (Defaults to `amount`) |
| `staffId` | Text | `3fa85f64-5717-4562-b3fc-2c963f66afa6` (Valid User UUID) | Yes |
| `staffSignature` | File | Choose an image file of the staff's signature | No |
| `receipt` | File | Choose an image or PDF of supporting invoices/receipts | No |

#### 2. Authority of Payment Voucher (PV) Fields (Form-Data)
| Key | Type | Value / Description | Required |
| :--- | :--- | :--- | :--- |
| `voucherType` | Text | `PAYMENT_AUTHORITY` | Yes |
| `date` | Text | `2026-05-28` | Yes |
| `purpose` | Text | Shipment clearance payment | Yes |
| `amount` | Text | `1250000` | Yes |
| `bankTransferDate` | Text | `2026-05-27` (YYYY-MM-DD) | Yes |
| `beneficiaryName` | Text | John Doe & Sons Logistics Ltd | Yes |
| `receipt` | File | Choose bank transfer slip / receipt file | No |

#### 3. Cash Payment Voucher Fields (Form-Data)
| Key | Type | Value / Description | Required |
| :--- | :--- | :--- | :--- |
| `voucherType` | Text | `CASH_PAYMENT_VOUCHER` | Yes |
| `date` | Text | `2026-05-28` | Yes |
| `purpose` | Text | Petty cash items | Yes |
| `amount` | Text | `12000` | Yes |
| `particulars` | Text | `[{"sn":1,"particulars":"A4 Paper Packs","amount":8000},{"sn":2,"particulars":"Office Pens","amount":4000}]` (JSON string) | Yes |
| `amountInWords` | Text | Twelve Thousand Naira Only | Yes |
| `itemsDescription`| Text | Stationery restocking | No |
| `itemsCount` | Text | `2` | No |
| `receivedByName` | Text | Jane Doe (Optional external recipient name) | No |
| `receivedById` | Text | `a8594d21-f09c-493e-b819-3fbc829da49e` (If recipient is an internal User) | No |
| `receivedBySignature`| File | Choose receiver's signature image | No |
| `issuedById` | Text | `0a8a927a-9e8a-442b-93ff-183d8a571da2` (Valid User UUID) | No |
| `issuedBySignature` | File | Choose issuer's signature image | No |

---

### Sample Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Voucher created successfully.",
  "data": {
    "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
    "voucherNumber": "EGL-VCH-KO9A3D12",
    "voucherType": "REQUEST_FOR_CASH",
    "date": "2026-05-28",
    "purpose": "For purchasing office supplies",
    "amount": 50000,
    "totalAmount": 50000,
    "status": "PENDING",
    "receiptUrl": "https://eaglenet-s3.s3.amazonaws.com/receipts/1779961234-invoice.pdf",
    "staffId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "staffSignatureUrl": "https://eaglenet-s3.s3.amazonaws.com/signatures/1779961235-sig.png",
    "createdById": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
    "createdAt": "2026-05-28T10:13:30.000Z",
    "updatedAt": "2026-05-28T10:13:30.000Z"
  }
}
```

---

### B. List Vouchers (`GET /api/vouchers`)
Retrieves all vouchers with optional filters.

* **URL**: `{{baseUrl}}/api/vouchers`
* **Method**: `GET`
* **Query Parameters**:
  - `page` (optional): `1`
  - `limit` (optional): `10`
  - `voucherType` (optional): `REQUEST_FOR_CASH` or `PAYMENT_AUTHORITY` or `CASH_PAYMENT_VOUCHER`
  - `status` (optional): `PENDING`, `APPROVED`, or `REJECTED`

### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
      "voucherNumber": "EGL-VCH-KO9A3D12",
      "voucherType": "REQUEST_FOR_CASH",
      "date": "2026-05-28",
      "amount": 50000,
      "status": "PENDING",
      "staff": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@eaglenet.com"
      },
      "createdBy": {
        "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@eaglenet.com"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### C. List My Vouchers (`GET /api/vouchers/my`)
Returns only the vouchers created by the currently authenticated user — a personal history endpoint that requires no special permission.

* **URL**: `{{baseUrl}}/api/vouchers/my`
* **Method**: `GET`
* **Query Parameters**:
  - `page` (optional): `1`
  - `limit` (optional): `10`
  - `voucherType` (optional): `REQUEST_FOR_CASH` or `PAYMENT_AUTHORITY` or `CASH_PAYMENT_VOUCHER`
  - `status` (optional): `PENDING`, `APPROVED`, or `REJECTED`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
      "voucherNumber": "EGL-VCH-KO9A3D12",
      "voucherType": "REQUEST_FOR_CASH",
      "date": "2026-05-28",
      "amount": 50000,
      "status": "APPROVED",
      "staff": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@eaglenet.com"
      },
      "createdBy": {
        "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@eaglenet.com"
      },
      "authorizedBy": {
        "id": "b1234567-89ab-cdef-0123-456789abcdef",
        "firstName": "Manager",
        "lastName": "Smith",
        "email": "manager@eaglenet.com"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### D. Get Single Voucher (`GET /api/vouchers/:id`)
Retrieves full structured details of a voucher.

* **URL**: `{{baseUrl}}/api/vouchers/:id`
* **Method**: `GET`

### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
    "voucherNumber": "EGL-VCH-KO9A3D12",
    "voucherType": "REQUEST_FOR_CASH",
    "date": "2026-05-28",
    "purpose": "For purchasing office supplies",
    "amount": 50000,
    "totalAmount": 50000,
    "status": "PENDING",
    "receiptUrl": "https://eaglenet-s3.s3.amazonaws.com/receipts/1779961234-invoice.pdf",
    "staffId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "staffSignatureUrl": "https://eaglenet-s3.s3.amazonaws.com/signatures/1779961235-sig.png",
    "staff": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@eaglenet.com"
    },
    "createdBy": {
      "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@eaglenet.com"
    }
  }
}
```

---

### E. Update Voucher Status (`PATCH /api/vouchers/:id/status`)
Used by authorized managers/admins to approve or reject a voucher and attach their digital signature.

* **URL**: `{{baseUrl}}/api/vouchers/:id/status`
* **Method**: `PATCH`
* **Body Type**: `form-data`

#### Fields (Form-Data)
| Key | Type | Value / Description | Required |
| :--- | :--- | :--- | :--- |
| `status` | Text | `APPROVED` or `REJECTED` | Yes |
| `rejectionReason`| Text | Bad receipt upload (Only required if rejecting) | No |
| `authorizedSignature` | File | Choose the authorizing manager's signature image | No |

### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Voucher approved successfully.",
  "data": {
    "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
    "voucherNumber": "EGL-VCH-KO9A3D12",
    "status": "APPROVED",
    "authorizedById": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
    "authorizedAt": "2026-05-28T11:15:00.000Z",
    "authorizedSignatureUrl": "https://eaglenet-s3.s3.amazonaws.com/signatures/manager-sig.png"
  }
}
```

---

## 3. Cashbook Module

The **Cashbook** module records all cash and bank transactions for financial tracking. Each entry captures the nature of the transaction, whether it's a debit or credit, the amount, and the associated bank.

All cashbook endpoints require authentication. Create, read, update, and delete require the `cashbook` permission. The `/my` endpoint is available to any authenticated user and returns only their own entries.

### A. Create Cashbook Entry (`POST /api/cashbook`)

* **URL**: `{{baseUrl}}/api/cashbook`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Body Type**: `raw` (JSON)

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `date` | String | `2026-05-30` (YYYY-MM-DD) | Yes |
| `natureOfTransaction` | String | `cash` or `bank` | Yes |
| `entryType` | String | `debit` or `credit` | Yes |
| `amount` | Number | `150000` | Yes |
| `bankName` | String | Name of the bank (e.g. "First Bank") | No |
| `bankAccountId` | UUID | ID of a registered bank account | No |
| `description` | String | Additional notes about the transaction | No |
| `voucherId` | UUID | Link this entry to an existing voucher | No |

#### Sample Request Body
```json
{
  "date": "2026-05-30",
  "natureOfTransaction": "bank",
  "entryType": "debit",
  "amount": 150000,
  "bankName": "First Bank",
  "bankAccountId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "description": "Payment for customs clearance on shipment EGL-EXP-240001",
  "voucherId": "78201a4e-c1cf-4d92-bb83-9d10459da104"
}
```

#### Sample Response (`201 Created`)
```json
{
  "status": "success",
  "data": {
    "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
    "referenceNumber": "EGL-CASH-A1B2C3D4",
    "date": "2026-05-30",
    "natureOfTransaction": "bank",
    "entryType": "debit",
    "amount": 150000,
    "bankName": "First Bank",
    "bankAccountId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "description": "Payment for customs clearance on shipment EGL-EXP-240001",
    "voucherId": "78201a4e-c1cf-4d92-bb83-9d10459da104",
    "createdById": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
    "isDeleted": false,
    "createdAt": "2026-05-30T10:15:00.000Z",
    "updatedAt": "2026-05-30T10:15:00.000Z"
  }
}
```

---

### B. List My Cashbook Entries (`GET /api/cashbook/my`)
Returns only the cashbook entries created by the currently authenticated user. No special permission required.

* **URL**: `{{baseUrl}}/api/cashbook/my`
* **Method**: `GET`
* **Query Parameters**:
  - `page` (optional): `1`
  - `limit` (optional): `10`
  - `natureOfTransaction` (optional): `cash` or `bank`
  - `entryType` (optional): `debit` or `credit`
  - `startDate` (optional): `2026-05-01`
  - `endDate` (optional): `2026-05-31`

#### Sample Response (`200 OK`, My Entries)
```json
{
  "status": "success",
  "data": [
    {
      "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
      "referenceNumber": "EGL-CASH-A1B2C3D4",
      "date": "2026-05-30",
      "natureOfTransaction": "bank",
      "entryType": "debit",
      "amount": 150000,
      "bankName": "First Bank",
      "description": "Payment for customs clearance",
      "createdBy": {
        "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@eaglenet.com"
      },
      "bankAccount": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "accountName": "EagleNet Operations",
        "accountNumber": "0123456789",
        "bankName": "First Bank"
      },
      "voucher": {
        "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
        "voucherNumber": "EGL-VCH-KO9A3D12",
        "voucherType": "REQUEST_FOR_CASH",
        "status": "APPROVED"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### C. List All Cashbook Entries (`GET /api/cashbook`)
Returns all cashbook entries with pagination and filters. Requires `cashbook:read` permission.

* **URL**: `{{baseUrl}}/api/cashbook`
* **Method**: `GET`
* **Query Parameters**:
  - `page` (optional): `1`
  - `limit` (optional): `10`
  - `natureOfTransaction` (optional): `cash` or `bank`
  - `entryType` (optional): `debit` or `credit`
  - `bankName` (optional): `First Bank`
  - `startDate` (optional): `2026-05-01`
  - `endDate` (optional): `2026-05-31`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
      "referenceNumber": "EGL-CASH-A1B2C3D4",
      "date": "2026-05-30",
      "natureOfTransaction": "bank",
      "entryType": "debit",
      "amount": 150000,
      "bankName": "First Bank",
      "description": "Payment for customs clearance",
      "createdBy": {
        "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@eaglenet.com"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### D. Get Single Cashbook Entry (`GET /api/cashbook/:id`)

* **URL**: `{{baseUrl}}/api/cashbook/:id`
* **Method**: `GET`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
    "referenceNumber": "EGL-CASH-A1B2C3D4",
    "date": "2026-05-30",
    "natureOfTransaction": "bank",
    "entryType": "debit",
    "amount": 150000,
    "bankName": "First Bank",
    "description": "Payment for customs clearance",
    "bankAccount": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "accountName": "EagleNet Operations",
      "accountNumber": "0123456789",
      "bankName": "First Bank"
    },
    "voucher": {
      "id": "78201a4e-c1cf-4d92-bb83-9d10459da104",
      "voucherNumber": "EGL-VCH-KO9A3D12",
      "voucherType": "REQUEST_FOR_CASH",
      "status": "APPROVED"
    },
    "createdBy": {
      "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@eaglenet.com"
    }
  }
}
```

---

### E. Update Cashbook Entry (`PATCH /api/cashbook/:id`)
Requires `cashbook:update` permission.

* **URL**: `{{baseUrl}}/api/cashbook/:id`
* **Method**: `PATCH`
* **Headers**: `Authorization: Bearer <token>`
* **Body Type**: `raw` (JSON)

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `date` | String | `2026-05-30` (YYYY-MM-DD) | No |
| `natureOfTransaction` | String | `cash` or `bank` | No |
| `entryType` | String | `debit` or `credit` | No |
| `amount` | Number | Updated amount | No |
| `bankName` | String | Updated bank name | No |
| `bankAccountId` | UUID | Updated linked bank account | No |
| `description` | String | Updated description | No |
| `voucherId` | UUID | Updated linked voucher | No |

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
    "referenceNumber": "EGL-CASH-A1B2C3D4",
    "date": "2026-05-30",
    "natureOfTransaction": "bank",
    "entryType": "debit",
    "amount": 160000,
    "bankName": "First Bank",
    "description": "Updated description with corrected amount"
  }
}
```

---

### F. Delete Cashbook Entry (`DELETE /api/cashbook/:id`)
Soft-deletes an entry. Requires `cashbook:delete` permission.

* **URL**: `{{baseUrl}}/api/cashbook/:id`
* **Method**: `DELETE`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Cashbook entry deleted."
}
```

---

## 4. Ledger Module

The **Ledger** module captures comprehensive financial ledger entries — each entry records a date, description, total amount, whether it's cash or bank (debit/credit), and optionally distributes the amount across 61 cost-center categories (FAAN, NAHCO, salaries, rent, fuel, etc.).

All ledger endpoints require authentication. Create, read, update, and delete require the `ledger` permission. The `/my` endpoint is available to any authenticated user and returns only their own entries.

### Item Categories Reference

The `items` object accepts any subset of these keys (all optional, all numbers):

`faan`, `nahco`, `sahcol`, `quarantineTreatmentStamping`, `airFreightSeaFreightCharges`, `allied`, `truckingExpenses`, `operationsExpensesLabourExpenses`, `passagesTravelsHotelFeedingAccommodation`, `maintenanceOfficeWarehouse`, `maintenanceOfOfficeTrucks`, `maintenanceOfOfficeCars`, `fuelForCars`, `dieselForTrucks`, `fuelForGeneratorServicing`, `engineOilLubricant`, `renewalRegistrationOfVehiclesPapers`, `itMaintenanceOnServerComputerAccessories`, `printingAndStationaries`, `salariesAndAllowancesBonus`, `telexTelephoneAllowanceAndPostagesTransferCharges`, `renewal`, `registrationAndSubscription`, `rent`, `localTransportGateFees`, `officeConsumables`, `rateGovernmentLevies`, `packingMaterials`, `advertisement`, `legalAndAuditFees`, `utilityExpenses`, `maintenanceOfficeEquipment`, `payeRemittance`, `vatRemittance`, `importExportClearanceAgencyFeeStoragesDemurrages`, `insuranceExpenses`, `additionToFixAsset`, `staffPensionRemittance`, `nsitf`, `citEducationTax`, `staffCostTraining`, `chargesSundry`, `staffLoan`, `businessProspectingExpenses`, `damagesBusinessLosses`, `interestOnLoan`, `loanRepayment`, `entertainmentExpenses`, `medicalExpenses`, `whtTax`, `disposalExpenses`, `officeSiteClearingExpensesDevelopment`, `securityExpenses`, `officeFenceArchDesignExpenses`, `healthSafetyExpenses`, `contraEntry`, `giftsDonations`, `sponsorshipFootDevelopment`, `loanGranted`, `penalty`, `internalTransfer`

---

### A. Create Ledger Entry (`POST /api/ledger`)

* **URL**: `{{baseUrl}}/api/ledger`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Body Type**: `raw` (JSON)

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `date` | String | `2026-05-30` (YYYY-MM-DD) | Yes |
| `description` | String | Operational notes for this entry | No |
| `amount` | Number | `500000` — total amount for this entry | Yes |
| `cashReceivedFromBank` | Number | `200000` — cash withdrawn/received from bank | No |
| `natureOfTransaction` | String | `cash` or `bank` | Yes |
| `entryType` | String | `debit` or `credit` | Yes |
| `items` | Object | Key-value pairs of category → amount as **strings** (see reference above) | No |

#### Sample Request Body
```json
{
  "date": "2026-05-30",
  "description": "May operational expenses",
  "amount": 500000,
  "cashReceivedFromBank": 200000,
  "natureOfTransaction": "bank",
  "entryType": "debit",
  "items": {
    "faan": "50000",
    "nahco": "30000",
    "sahcol": "20000",
    "salariesAndAllowancesBonus": "250000",
    "dieselForTrucks": "80000",
    "rent": "70000"
  }
}
```

#### Sample Response (`201 Created`)
```json
{
  "status": "success",
  "data": {
    "id": "d1e2f3a4-b5c6-7890-defg-hijk12345678",
    "referenceNumber": "EGL-LDG-A1B2C3D4",
    "date": "2026-05-30",
    "description": "May operational expenses",
    "amount": 500000,
    "cashReceivedFromBank": 200000,
    "natureOfTransaction": "bank",
    "entryType": "debit",
    "items": {
      "faan": "50000",
      "nahco": "30000",
      "sahcol": "20000",
      "salariesAndAllowancesBonus": "250000",
      "dieselForTrucks": "80000",
      "rent": "70000"
    },
    "createdById": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
    "isDeleted": false,
    "createdAt": "2026-05-30T11:00:00.000Z",
    "updatedAt": "2026-05-30T11:00:00.000Z"
  }
}
```

---

### B. List My Ledger Entries (`GET /api/ledger/my`)
Returns only the ledger entries created by the currently authenticated user. No special permission required.

* **URL**: `{{baseUrl}}/api/ledger/my`
* **Method**: `GET`
* **Query Parameters**:
  - `page` (optional): `1`
  - `limit` (optional): `10`
  - `natureOfTransaction` (optional): `cash` or `bank`
  - `entryType` (optional): `debit` or `credit`
  - `startDate` (optional): `2026-05-01`
  - `endDate` (optional): `2026-05-31`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "d1e2f3a4-b5c6-7890-defg-hijk12345678",
      "referenceNumber": "EGL-LDG-A1B2C3D4",
      "date": "2026-05-30",
      "description": "May operational expenses",
      "amount": 500000,
      "cashReceivedFromBank": 200000,
      "natureOfTransaction": "bank",
      "entryType": "debit",
      "items": {
        "faan": "50000",
        "salariesAndAllowancesBonus": "250000"
      },
      "createdBy": {
        "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@eaglenet.com"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### C. List All Ledger Entries (`GET /api/ledger`)
Returns all ledger entries with pagination and filters. Requires `ledger:read` permission.

* **URL**: `{{baseUrl}}/api/ledger`
* **Method**: `GET`
* **Query Parameters**:
  - `page` (optional): `1`
  - `limit` (optional): `10`
  - `natureOfTransaction` (optional): `cash` or `bank`
  - `entryType` (optional): `debit` or `credit`
  - `startDate` (optional): `2026-05-01`
  - `endDate` (optional): `2026-05-31`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "d1e2f3a4-b5c6-7890-defg-hijk12345678",
      "referenceNumber": "EGL-LDG-A1B2C3D4",
      "date": "2026-05-30",
      "description": "May operational expenses",
      "amount": 500000,
      "cashReceivedFromBank": 200000,
      "natureOfTransaction": "bank",
      "entryType": "debit",
      "items": {
        "faan": "50000",
        "nahco": "30000",
        "sahcol": "20000",
        "salariesAndAllowancesBonus": "250000",
        "dieselForTrucks": "80000",
        "rent": "70000"
      },
      "createdBy": {
        "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@eaglenet.com"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### D. Get Single Ledger Entry (`GET /api/ledger/:id`)

* **URL**: `{{baseUrl}}/api/ledger/:id`
* **Method**: `GET`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "d1e2f3a4-b5c6-7890-defg-hijk12345678",
    "referenceNumber": "EGL-LDG-A1B2C3D4",
    "date": "2026-05-30",
    "description": "May operational expenses",
    "amount": 500000,
    "cashReceivedFromBank": 200000,
    "natureOfTransaction": "bank",
    "entryType": "debit",
    "items": {
      "faan": "50000",
      "nahco": "30000",
      "sahcol": "20000",
      "salariesAndAllowancesBonus": "250000",
      "dieselForTrucks": "80000",
      "rent": "70000"
    },
    "createdBy": {
      "id": "0a8a927a-9e8a-442b-93ff-183d8a571da2",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@eaglenet.com"
    }
  }
}
```

---

### E. Update Ledger Entry (`PATCH /api/ledger/:id`)
Requires `ledger:update` permission. All fields optional — only send what needs to change.

* **URL**: `{{baseUrl}}/api/ledger/:id`
* **Method**: `PATCH`
* **Headers**: `Authorization: Bearer <token>`
* **Body Type**: `raw` (JSON)

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `date` | String | `2026-05-31` (YYYY-MM-DD) | No |
| `description` | String | Updated description | No |
| `amount` | Number | Updated total amount | No |
| `cashReceivedFromBank` | Number | Updated cash from bank | No |
| `natureOfTransaction` | String | `cash` or `bank` | No |
| `entryType` | String | `debit` or `credit` | No |
| `items` | Object | Updated category amounts as **strings** (replaces entire object) | No |

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "d1e2f3a4-b5c6-7890-defg-hijk12345678",
    "referenceNumber": "EGL-LDG-A1B2C3D4",
    "date": "2026-05-31",
    "description": "May operational expenses - corrected",
    "amount": 520000,
    "items": {
      "faan": "55000",
      "nahco": "30000",
      "salariesAndAllowancesBonus": "250000",
      "dieselForTrucks": "80000",
      "rent": "70000",
      "officeConsumables": "35000"
    }
  }
}
```

---

### F. Delete Ledger Entry (`DELETE /api/ledger/:id`)
Soft-deletes an entry. Requires `ledger:delete` permission.

* **URL**: `{{baseUrl}}/api/ledger/:id`
* **Method**: `DELETE`

#### Sample Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Ledger entry deleted."
}
```

---

## 5. Quick Checklist for Postman Errors

1. **Zod Validation Error (`400 Bad Request`)**:
   - Ensure the `date` is formatted precisely as `YYYY-MM-DD`.
   - For `particulars` in a Cash Payment Voucher, ensure your value is valid JSON, e.g. `[{"sn": 1, "particulars": "Item A", "amount": 100}]`.
   - For cashbook, make sure `natureOfTransaction` is either `cash` or `bank`.
   - For cashbook, make sure `entryType` is either `debit` or `credit`.
   - For ledger, make sure `natureOfTransaction` is either `cash` or `bank`.
   - For ledger, make sure `entryType` is either `debit` or `credit`.
   - For ledger, the `items` object keys must match the documented category names exactly and all values must be strings (e.g. `"50000"`, not `50000`). Values over 500 characters are rejected.
   - For ledger, HTML tags, event handlers (onclick, etc.), and `javascript:` URIs are stripped from item values automatically.
2. **File Size/Type Issues**:
   - Limit file uploads (receipts, signatures) to image files (`.png`, `.jpg`, `.jpeg`) or document layouts (`.pdf`).


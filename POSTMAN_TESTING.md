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

### C. Get Single Voucher (`GET /api/vouchers/:id`)
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

### D. Update Voucher Status (`PATCH /api/vouchers/:id/status`)
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

## 3. Quick Checklist for Postman Errors

1. **Zod Validation Error (`400 Bad Request`)**:
   - Ensure the `date` is formatted precisely as `YYYY-MM-DD`.
   - For `particulars` in a Cash Payment Voucher, ensure your value is valid JSON, e.g. `[{"sn": 1, "particulars": "Item A", "amount": 100}]`.
2. **File Size/Type Issues**:
   - Limit file uploads (receipts, signatures) to image files (`.png`, `.jpg`, `.jpeg`) or document layouts (`.pdf`).

# 🚀 Backblaze B2 Storage — Postman Testing Guide

This guide explains how to test the new Backblaze B2 cloud storage integration in EagleNet. Use the provided [backblaze_test_collection.json](./backblaze_test_collection.json) in Postman to follow along.

---

## 🛠 Prerequisites

Before starting, ensure you have set these **Collection Variables** in Postman:
1.  `baseUrl`: `http://localhost:3000/api`
2.  `token`: Your admin access token (get this from the Login request).
3.  `shipmentId`: A valid UUID of an existing shipment from your database.

---

## 🏁 Step-by-Step Test Flow

### Step 0: Verify Connectivity
**Request:** `0. Health Check -> Storage Connectivity Health`
*   **What it does:** Probes Backblaze B2 to see if your credentials and bucket name are correct.
*   **Expected Result:** 
    ```json
    { "status": "success", "data": { "connected": true, "message": "Successfully connected to Backblaze B2..." } }
    ```
*   **If it fails:** Check your `.env` for `B2_KEY_ID` or `B2_APPLICATION_KEY` typos.

---

### Step 1: Upload your first file to B2
**Request:** `1. Upload Process -> Upload Document (Initial)`
*   **Action:** 
    1. Go to the **Body** tab.
    2. Ensure the mode is set to **form-data**.
    3. In the `file` row, hover over the value and click **"Select Files"** to pick a document from your computer.
*   **What happens:** The file is sent to the API, uploaded to B2, and a record is saved in PostgreSQL with the file size.
*   **Expected Result:** 
    *   Check for `fileUrl` (starts with `https://f005...`).
    *   Check for `fileSize` (shows the size in bytes).
*   **Action:** Copy the `id` from the response and paste it into your Postman `documentId` variable.

---

### Step 2: Retrieve & Verify Data
**Request:** `2. Retrieval -> List Shipment Documents`
*   **What it does:** Fetches all documents for the shipment you specified.
*   **Verification:** Ensure your new document appears in the list and that the `fileUrl` is a valid Backblaze link.

---

### Step 3: Test Secure Downloads
**Request:** `2. Retrieval -> Get Presigned Download URL`
*   **What it does:** Generates a short-lived (1 hour) secure link for private files.
*   **Verification:** Copy the `downloadUrl` from the response and paste it into your browser. The file should download immediately.
*   **Audit:** This action is automatically logged in the `document_activity` table.

---

### Step 4: Test Versioning
**Request:** `1. Upload Process -> Upload New Version`
*   **Action:** Select a **different file** in the `file` key in the Body tab.
*   **What happens:** Uploads the new version to B2 and increments the `version_number` in the database.
*   **Verification:** Run `List Document Versions` to see both the original and the new version with different sizes/keys.

---

### Step 5: Clean Up (Hard Delete)
**Request:** `3. Management -> Delete Document`
*   **What it does:**
    1. Deletes the physical file from the **Backblaze B2 bucket**.
    2. Soft-deletes the database record (sets `deletedAt`).
*   **Verification:** Check your Backblaze B2 dashboard; the file should be gone.

---

## 📊 Endpoint Summary

| Feature | Method | Route | Permission Required |
| :--- | :--- | :--- | :--- |
| **Health Check** | `GET` | `/documents/storage/health` | `adminOnly` |
| **Upload** | `POST` | `/documents` | `document:create` |
| **Download Link** | `GET` | `/documents/:id/download` | `document:read` |
| **Add Version** | `POST` | `/documents/:id/versions` | `document:update` |
| **Delete** | `DELETE` | `/documents/:id` | `document:delete` |

---

## 🆘 Troubleshooting Common B2 Errors

*   **`NoSuchBucket`**: Your `B2_BUCKET_NAME` in `.env` doesn't match what is in your B2 account.
*   **`InvalidAccessKeyId`**: Your `B2_KEY_ID` is incorrect.
*   **`SignatureDoesNotMatch`**: Your `B2_APPLICATION_KEY` is incorrect.
*   **`403 Forbidden`**: Check if your B2 bucket has "Public" or "Private" settings. Presigned URLs work for both, but direct URLs only work for Public.

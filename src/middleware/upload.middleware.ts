import { Request as _Request } from "express";
import multer from "multer";
import path from "path";


/**
 * Allowed MIME types for archival document uploads.
 */
const ARCHIVE_ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/vnd.ms-excel",                                          // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/msword",                                                 // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

const ARCHIVE_ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png|xls|xlsx|doc|docx)$/i;

/**
 * documentUpload — for standard document uploads (PDF, images, Word, Excel).
 * Uses memory storage so files can be streamed directly to S3-compatible storage.
 */
const storage = multer.memoryStorage();

export const documentUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB — increased to accommodate Excel/Word files
  },
  fileFilter: (_req, file, cb) => {
    const validExt = ARCHIVE_ALLOWED_EXTS.test(path.extname(file.originalname));
    const validMime = ARCHIVE_ALLOWED_MIMES.includes(file.mimetype);
    if (validExt && validMime) {
      return cb(null, true);
    }
    cb(new Error("Unsupported file type. Allowed: PDF, JPG, PNG, XLS, XLSX, DOC, DOCX"));
  },
});

/**
 * bulkImportUpload — dedicated multer instance for bulk Excel/CSV imports only.
 */
export const bulkImportUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const validExt = /\.(xls|xlsx|csv)$/i.test(path.extname(file.originalname));
    const validMime = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ].includes(file.mimetype);
    if (validExt && validMime) {
      return cb(null, true);
    }
    cb(new Error("Bulk imports only accept .xls, .xlsx, or .csv files."));
  },
});

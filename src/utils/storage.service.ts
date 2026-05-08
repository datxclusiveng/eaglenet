import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures a URL string starts with https://.
 * B2_ENDPOINT may be supplied with or without the scheme.
 */
function normalizeEndpoint(raw: string): string {
  if (!raw) return "";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

// ─── Client Configuration ─────────────────────────────────────────────────────

const B2_ENDPOINT = normalizeEndpoint(process.env.B2_ENDPOINT || "");
const B2_REGION = process.env.B2_REGION || "us-east-005";
const BUCKET_NAME = process.env.B2_BUCKET_NAME || "eaglenet-storage";

/**
 * Optional: B2 public/friendly download base URL.
 * Format: https://f{clusterN}.backblazeb2.com/file/{bucket}
 * When set, public file URLs use this instead of the S3 endpoint.
 * Example: B2_PUBLIC_URL=https://f005.backblazeb2.com/file/Eaglenet
 */
const B2_PUBLIC_URL = process.env.B2_PUBLIC_URL
  ? process.env.B2_PUBLIC_URL.replace(/\/$/, "") // strip trailing slash
  : null;

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === "true";
const LOCAL_STORAGE_DIR = path.join(process.cwd(), "public/uploads");

const s3Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APPLICATION_KEY || "",
  },
  // Required for B2 S3-compatible API
  forcePathStyle: true,
});

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Uploads a file buffer to Backblaze B2 (via the S3-compatible API).
 * Falls back to local disk storage when USE_LOCAL_STORAGE=true.
 *
 * @returns { url, key }
 *   url  — the publicly accessible file URL saved to the database
 *   key  — the internal B2 object key used for deletion / presigning
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalName: string,
  mimetype: string,
  folder: string = "general"
): Promise<{ url: string; key: string }> {
  const fileExtension = path.extname(originalName);
  const uniqueFilename = `${folder}/${uuidv4()}${fileExtension}`;

  if (USE_LOCAL_STORAGE) {
    const fullPath = path.join(LOCAL_STORAGE_DIR, uniqueFilename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, fileBuffer);
    return {
      url: `/public/uploads/${uniqueFilename}`,
      key: uniqueFilename,
    };
  }

  // ── B2 Upload ──────────────────────────────────────────────────────────────
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: uniqueFilename,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  await s3Client.send(command);

  // Build the public URL:
  //   • If B2_PUBLIC_URL is set (friendly CDN), use that.
  //   • Otherwise fall back to the S3-compatible endpoint URL.
  const url = B2_PUBLIC_URL
    ? `${B2_PUBLIC_URL}/${uniqueFilename}`
    : `${B2_ENDPOINT}/${BUCKET_NAME}/${uniqueFilename}`;

  return { url, key: uniqueFilename };
}

/**
 * Generates a short-lived presigned URL for downloading a private B2 object.
 * Use this for documents that should NOT be publicly accessible by default.
 *
 * @param key              The object key (as stored in `fileKey` column)
 * @param expiresInSeconds URL expiry (default: 3600 = 1 hour)
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (USE_LOCAL_STORAGE) {
    // Local files are served as static assets — no signing needed
    return `/public/uploads/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Permanently deletes an object from Backblaze B2 (or local disk).
 * Called when a document is hard-deleted from the system.
 *
 * @param key The object key stored in the `fileKey` column
 */
export async function deleteFileFromStorage(key: string): Promise<void> {
  if (USE_LOCAL_STORAGE) {
    const fullPath = path.join(LOCAL_STORAGE_DIR, key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

// ─── Storage Health Check ─────────────────────────────────────────────────────

export interface B2HealthResult {
  /** Whether the connection and bucket access succeeded */
  connected: boolean;
  /** Human-readable status message */
  message: string;
  /** Storage mode: "backblaze" | "local" */
  mode: "backblaze" | "local";
  /** Configuration snapshot (no secrets) */
  config: {
    endpoint: string;
    bucket: string;
    region: string;
    publicUrl: string | null;
  };
  /** ISO timestamp of the check */
  checkedAt: string;
  /** Error detail when connected === false */
  error?: string;
}

/**
 * Verifies connectivity to Backblaze B2 by issuing a HeadBucket request.
 *
 * - In local-storage mode, it simply confirms the upload directory exists.
 * - In B2 mode, it contacts the B2 S3-compatible endpoint and checks that
 *   the configured bucket is accessible with the supplied credentials.
 *
 * This is safe to call repeatedly — HeadBucket is a read-only metadata
 * request and does not create, modify, or delete any objects.
 */
export async function checkB2Connection(): Promise<B2HealthResult> {
  const checkedAt = new Date().toISOString();

  const config = {
    endpoint: B2_ENDPOINT || "(not set)",
    bucket: BUCKET_NAME,
    region: B2_REGION,
    publicUrl: B2_PUBLIC_URL,
  };

  // ── Local storage mode ────────────────────────────────────────────────────
  if (USE_LOCAL_STORAGE) {
    const exists = fs.existsSync(LOCAL_STORAGE_DIR);
    return {
      connected: true,
      message: exists
        ? `Local storage active. Upload directory exists at: ${LOCAL_STORAGE_DIR}`
        : `Local storage active. Upload directory will be created on first upload.`,
      mode: "local",
      config,
      checkedAt,
    };
  }

  // ── B2 mode ───────────────────────────────────────────────────────────────
  if (!process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY) {
    return {
      connected: false,
      message: "B2 credentials are missing. Set B2_KEY_ID and B2_APPLICATION_KEY in your environment.",
      mode: "backblaze",
      config,
      checkedAt,
      error: "Missing credentials",
    };
  }

  try {
    const start = Date.now();
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      message: `Successfully connected to Backblaze B2. Bucket "${BUCKET_NAME}" is accessible. Latency: ${latencyMs}ms`,
      mode: "backblaze",
      config,
      checkedAt,
    };
  } catch (err: any) {
    // Extract a clean error message — B2 returns S3-style error codes
    const code: string = err?.Code || err?.name || "UnknownError";
    const detail: string = err?.message || String(err);

    let message = `Failed to connect to Backblaze B2 bucket "${BUCKET_NAME}".`;
    if (code === "NoSuchBucket") {
      message += " Bucket does not exist — check B2_BUCKET_NAME.";
    } else if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
      message += " Invalid credentials — check B2_KEY_ID and B2_APPLICATION_KEY.";
    } else if (code === "NetworkingError" || code === "ENOTFOUND") {
      message += " Network error — check B2_ENDPOINT and internet connectivity.";
    } else {
      message += ` Error code: ${code}.`;
    }

    return {
      connected: false,
      message,
      mode: "backblaze",
      config,
      checkedAt,
      error: detail,
    };
  }
}

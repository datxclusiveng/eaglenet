import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Configure B2 via S3-compatible API
const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: process.env.B2_REGION || "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APPLICATION_KEY || "",
  },
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || "eaglenet-storage";
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === "true";
const LOCAL_STORAGE_DIR = path.join(process.cwd(), "public/uploads");

/**
 * Uploads a file to B2, falling back to local storage if configured.
 * Returns the universal URL and the internal key object for deletion tracking.
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
      key: uniqueFilename, // Local path reference
    };
  }

  // B2 (S3) Upload
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: uniqueFilename,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  await s3Client.send(command);

  // Return public B2 bucket path. If private, we would return a generic endpoint and sign on demand
  const b2Url = `${process.env.B2_ENDPOINT}/${BUCKET_NAME}/${uniqueFilename}`;
  
  return {
    url: b2Url,
    key: uniqueFilename,
  };
}

/**
 * Generates a presigned short-lived URL for downloading restricted files from B2.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
  if (USE_LOCAL_STORAGE) {
    return `/public/uploads/${key}`; // Local URLs are typically treated statically
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Permanently deletes an object from storage.
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

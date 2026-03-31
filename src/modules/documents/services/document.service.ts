import { AppDataSource } from "../../../../database/data-source";
import { Document } from "../entities/Document";
import { DocumentVersion } from "../entities/DocumentVersion";
import { DocumentActivity, DocumentAction } from "../entities/DocumentActivity";

const docRepo = () => AppDataSource.getRepository(Document);
const versionRepo = () => AppDataSource.getRepository(DocumentVersion);
const activityRepo = () => AppDataSource.getRepository(DocumentActivity);

// ─── Create a new document version ─────────────────────────────────────────
export async function createDocumentVersion(
  documentId: string,
  uploaderId: string,
  fileData: { fileUrl: string; fileKey: string; contentType: string },
  comment: string
): Promise<DocumentVersion> {
  const doc = await docRepo().findOneOrFail({ where: { id: documentId } });

  // Count existing versions to compute the next version number
  const existingCount = await versionRepo().count({ where: { documentId } });
  const versionNumber = existingCount + 1;

  const version = versionRepo().create({
    documentId,
    fileUrl: fileData.fileUrl,
    fileKey: fileData.fileKey,
    contentType: fileData.contentType,
    versionNumber,
    uploaderId,
    comment,
  });

  await versionRepo().save(version);

  // Keep currentVersionId on the Document pointing at the latest version
  doc.currentVersionId = version.id;
  await docRepo().save(doc);

  // Record activity
  await logDocumentActivity(documentId, uploaderId, DocumentAction.NEW_VERSION, comment);

  return version;
}

// ─── List all versions for a document ──────────────────────────────────────
export async function getDocumentVersions(
  documentId: string,
  opts?: { skip: number; take: number }
): Promise<[DocumentVersion[], number]> {
  return versionRepo().findAndCount({
    where: { documentId },
    relations: ["uploader"],
    order: { versionNumber: "DESC" },
    skip: opts?.skip,
    take: opts?.take,
  });
}

// ─── Log an activity entry ──────────────────────────────────────────────────
export async function logDocumentActivity(
  documentId: string,
  userId: string,
  action: DocumentAction,
  comment?: string
): Promise<DocumentActivity> {
  const entry = activityRepo().create({ documentId, userId, action, comment });
  return activityRepo().save(entry);
}

// ─── Get activity log for a document ────────────────────────────────────────
export async function getDocumentActivity(
  documentId: string,
  opts?: { skip: number; take: number }
): Promise<[DocumentActivity[], number]> {
  return activityRepo().findAndCount({
    where: { documentId },
    relations: ["user"],
    order: { timestamp: "DESC" },
    skip: opts?.skip,
    take: opts?.take,
  });
}

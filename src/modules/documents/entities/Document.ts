import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { User } from "../../users/entities/User";
import { Shipment } from "../../shipments/entities/Shipment";
import { Department } from "../../departments/entities/Department";
import { DocumentVersion } from "./DocumentVersion";
import { DocumentActivity } from "./DocumentActivity";

export enum DocumentStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export enum VisibilityScope {
  GLOBAL = "GLOBAL",           // Visible to all staff with document:read
  DEPARTMENT = "DEPARTMENT",   // Visible only to staff in the same department
  PRIVATE = "PRIVATE",         // Visible only to uploader and Superadmins
}

@Entity("documents")
export class Document {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string; // e.g., "Bill of Lading", "Packing List"

  @Column({ name: "file_url" })
  fileUrl!: string;

  @Column({ name: "file_key" })
  fileKey!: string; // S3/B1 Key

  @Column({ name: "content_type" })
  contentType!: string;

  @Column({ name: "document_type" })
  documentType!: string; // e.g., "ID_CARD", "INSURANCE", "MANIFEST"

  @Column({
    type: "enum",
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status!: DocumentStatus;

  @Column({
    type: "enum",
    enum: VisibilityScope,
    default: VisibilityScope.GLOBAL,
    name: "visibility_scope",
  })
  visibilityScope!: VisibilityScope;

  @Column({ name: "is_archived", default: false })
  isArchived!: boolean;

  @Column({ name: "admin_tags", type: "jsonb", nullable: true, default: [] })
  adminTags?: string[];

  @Column({ name: "commit_message", type: "text", nullable: true })
  commitMessage?: string;

  /**
   * Plain text extracted from file content at upload time.
   * Used for PostgreSQL full-text search. Null for images/unsupported types.
   */
  @Column({ name: "extracted_text", type: "text", nullable: true })
  extractedText?: string;

  @Column({ type: "jsonb", nullable: true, default: {} })
  metadata?: Record<string, any>; // e.g., { "expiry_date": "2025-01-01" }

  @Column({ name: "shipment_id", nullable: true })
  shipmentId?: string;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "shipment_id" })
  shipment?: Shipment;

  @Column({ name: "department_id", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  @Column({ name: "uploader_id" })
  uploaderId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "uploader_id" })
  uploader!: User;

  /**
   * Points to the latest accepted version of this document.
   * Null until the first version is uploaded.
   */
  @Column({ name: "current_version_id", nullable: true })
  currentVersionId?: string;

  @OneToMany(() => DocumentVersion, (v) => v.document)
  versions!: DocumentVersion[];

  @OneToMany(() => DocumentActivity, (a) => a.document)
  activityLog!: DocumentActivity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}

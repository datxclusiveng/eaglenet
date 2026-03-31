import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";
import { Document } from "./Document";

@Entity("document_versions")
export class DocumentVersion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "document_id" })
  documentId!: string;

  @ManyToOne(() => Document, { onDelete: "CASCADE" })
  @JoinColumn({ name: "document_id" })
  document!: Document;

  @Column({ name: "file_url" })
  fileUrl!: string;

  @Column({ name: "file_key" })
  fileKey!: string;

  @Column({ name: "content_type" })
  contentType!: string;

  /**
   * Monotonically increasing within a document.
   * Starts at 1 and is incremented by the service on each new upload.
   */
  @Index()
  @Column({ name: "version_number", type: "int" })
  versionNumber!: number;

  @Column({ name: "uploader_id" })
  uploaderId!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "uploader_id" })
  uploader!: User;

  /**
   * Mandatory commit message per architecture spec.
   * Describes what changed in this version.
   */
  @Column({ type: "text" })
  comment!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

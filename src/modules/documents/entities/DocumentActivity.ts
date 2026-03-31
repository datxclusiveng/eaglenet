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

export enum DocumentAction {
  UPLOADED = "UPLOADED",
  VIEWED = "VIEWED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEW_VERSION = "NEW_VERSION",
  DELETED = "DELETED",
}

@Entity("document_activity")
export class DocumentActivity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "document_id" })
  documentId!: string;

  @ManyToOne(() => Document, { onDelete: "CASCADE" })
  @JoinColumn({ name: "document_id" })
  document!: Document;

  @Index()
  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    type: "enum",
    enum: DocumentAction,
  })
  action!: DocumentAction;

  /**
   * Optional human-readable comment explaining the action.
   * Mandatory on NEW_VERSION and REJECTED actions.
   */
  @Column({ type: "text", nullable: true })
  comment?: string;

  @Index()
  @CreateDateColumn({ name: "timestamp" })
  timestamp!: Date;
}

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

export enum MessageType {
  TEXT = "text",
  FILE = "file",
}

/**
 * Direct messages between internal staff members.
 * Grouped into threads by `threadId`.
 */
@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "sender_id" })
  senderId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender!: User;

  @Index()
  @Column({ name: "recipient_id" })
  recipientId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipient_id" })
  recipient!: User;

  /**
   * Thread identifier — derived as a deterministic composite of the two
   * user IDs sorted alphabetically, so both sides share one thread ID.
   * e.g. `thread_${[userAId, userBId].sort().join("_")}`
   */
  @Index()
  @Column({ name: "thread_id" })
  threadId!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({
    name: "message_type",
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType!: MessageType;

  /** URL of any attached file */
  @Column({ name: "attachment_url", nullable: true })
  attachmentUrl?: string;

  /** Original filename of the attachment (for display) */
  @Column({ name: "attachment_name", nullable: true })
  attachmentName?: string;

  @Column({ name: "sent_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  sentAt!: Date;

  /** Set when the recipient reads the message */
  @Column({ name: "read_at", type: "timestamp", nullable: true })
  readAt?: Date;

  /** Soft-delete flag — message hidden from conversation but retained for audit */
  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

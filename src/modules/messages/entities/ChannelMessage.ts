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
import { ChatChannel } from "./ChatChannel";
import { MessageType } from "./Message";

/**
 * A message sent inside a team channel.
 */
@Entity("channel_messages")
export class ChannelMessage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "channel_id" })
  channelId!: string;

  @ManyToOne(() => ChatChannel, (c) => c.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "channel_id" })
  channel!: ChatChannel;

  @Index()
  @Column({ name: "sender_id" })
  senderId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender!: User;

  @Column({ type: "text" })
  content!: string;

  @Column({
    name: "message_type",
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType!: MessageType;

  @Column({ name: "attachment_url", nullable: true })
  attachmentUrl?: string;

  @Column({ name: "attachment_name", nullable: true })
  attachmentName?: string;

  /** Soft-delete — hidden from view but retained for audit */
  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @Column({ name: "sent_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  sentAt!: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

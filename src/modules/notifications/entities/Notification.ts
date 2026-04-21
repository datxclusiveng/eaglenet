import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";

export enum NotificationType {
  STATUS_UPDATE = "status-update",
  SYSTEM = "system",
  ALERT = "alert",
  AUDIT = "audit",
  MESSAGE = "message",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column()
  title!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({
    type: "enum",
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type!: NotificationType;

  /**
   * The entity category this notification relates to.
   * e.g. "Shipment", "Payment", "Document", "Message"
   */
  @Column({ name: "related_entity_type", nullable: true })
  relatedEntityType?: string;

  /** UUID of the related entity */
  @Column({ name: "related_entity_id", nullable: true })
  relatedEntityId?: string;

  /** Front-end deep-link, e.g. "/shipments/uuid-here" */
  @Column({ name: "action_url", nullable: true })
  actionUrl?: string;

  @Column({ name: "is_read", default: false })
  isRead!: boolean;

  /** Set when the user reads the notification */
  @Column({ name: "read_at", type: "timestamp", nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

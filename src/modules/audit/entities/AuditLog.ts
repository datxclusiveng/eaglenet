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

export enum AuditAction {
  // Auth
  LOGIN = "login",
  LOGIN_FAILED = "login_failed",
  LOGOUT = "logout",
  PASSWORD_CHANGE = "password_change",
  PASSWORD_RESET = "password_reset",
  // CRUD
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  // Document
  VIEW = "view",
  DOWNLOAD = "download",
  SHARE = "share",
  // Shipment
  STATUS_CHANGE = "status_change",
  ASSIGN = "assign",
  // Financial
  PAYMENT_CREATED = "payment_created",
  PAYMENT_UPDATED = "payment_updated",
  // Messaging
  SEND = "send",
}

/**
 * Immutable, append-only audit trail.
 * This table MUST never have DELETE or UPDATE operations applied to it.
 */
@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /**
   * The entity category: "Shipment", "User", "Department", "Document",
   * "Payment", "Message", "Role", "Permission"
   */
  @Index()
  @Column({ name: "entity_type" })
  entityType!: string;

  /** UUID of the specific entity that was acted upon */
  @Index()
  @Column({ name: "entity_id", nullable: true })
  entityId?: string;

  /** The action performed — use AuditAction enum values */
  @Index()
  @Column()
  action!: string;

  /**
   * Field-level diff: { before: {}, after: {} } for updates,
   * or descriptive payload for other actions.
   */
  @Column({ name: "action_details", type: "jsonb", nullable: true })
  actionDetails?: Record<string, any>;

  /** The user who performed the action */
  @Index()
  @Column({ name: "performed_by", nullable: true })
  performedBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "performed_by" })
  performer?: User;

  /** For department-level audit filtering */
  @Index()
  @Column({ name: "department_id", nullable: true })
  departmentId?: string;

  /** IP address of the client at time of action */
  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string;

  /** Browser / client user-agent string */
  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent?: string;

  /** Optional reason provided by user for sensitive actions */
  @Column({ type: "text", nullable: true })
  reason?: string;

  @Index()
  @CreateDateColumn({ name: "performed_at" })
  performedAt!: Date;
}

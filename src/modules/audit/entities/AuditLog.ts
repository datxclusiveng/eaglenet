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

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /**
   * E.g. "USER_DELETED", "SHIPMENT_EDITED", "ROLE_UPDATED"
   */
  @Index()
  @Column({ name: "action" })
  action!: string;

  /**
   * The resource type affected: "User", "Shipment", etc.
   */
  @Column({ name: "resource" })
  resource!: string;

  /**
   * The ID of the affected resource (if applicable)
   */
  @Index()
  @Column({ name: "resource_id", nullable: true })
  resourceId?: string;

  /**
   * The user who performed the action
   */
  @Index()
  @Column({ name: "user_id", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "user_id" })
  user?: User;

  /**
   * Detailed payload of changes made (JSON)
   */
  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, any>;

  /**
   * IP address of the requesting client
   */
  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string;

  @Index()
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

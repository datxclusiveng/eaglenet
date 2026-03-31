import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "../../users/entities/User";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column()
  title!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({ name: "is_read", default: false })
  isRead!: boolean;

  /**
   * Action link for the user to click in the UI.
   * Example: "/shipments/uuid-here"
   */
  @Column({ name: "action_url", nullable: true })
  actionUrl?: string;

  /**
   * Internal type for UI-specific icons/colors.
   * "SHIPMENT", "PAYMENT", "DOCUMENT", "SYSTEM"
   */
  @Column({ default: "SYSTEM" })
  type!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

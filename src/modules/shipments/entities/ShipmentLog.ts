import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "../../users/entities/User";
import { Shipment } from "./Shipment";

export enum LogVisibility {
  PUBLIC = "public",
  INTERNAL = "internal",
}

@Entity("shipment_logs")
export class ShipmentLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "shipment_id" })
  shipmentId!: string;

  @ManyToOne(() => Shipment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shipment_id" })
  shipment!: Shipment;

  @Column({ name: "user_id", nullable: true })
  changedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  changedBy?: User;

  @Column({ nullable: true })
  action!: string; // e.g., "status_change", "creation", "update"

  @Column({ name: "previous_status", nullable: true })
  previousStatus?: string;

  @Column({ name: "new_status", nullable: true })
  newStatus?: string;

  @Column({ type: "text", nullable: true })
  note?: string;

  @Column({ name: "email_sent", default: false })
  emailSent!: boolean;

  @Column({ type: "enum", enum: LogVisibility, default: LogVisibility.INTERNAL })
  visibility!: LogVisibility;

  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string;

  @Column({ name: "user_agent", nullable: true })
  userAgent?: string;

  @Column({ type: "jsonb", nullable: true, default: {} })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

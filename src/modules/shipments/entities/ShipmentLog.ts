import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "../../users/entities/User";
import { Shipment } from "./Shipment";

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
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column()
  action!: string; // e.g., "created", "status_updated", "price_assigned", "department_assigned"

  /**
   * Detail about the action taken.
   * Example: { "old_status": "ORDER_PLACED", "new_status": "SHIPPED", "comment": "Package is on the move" }
   */
  @Column({ type: "jsonb", nullable: true, default: {} })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

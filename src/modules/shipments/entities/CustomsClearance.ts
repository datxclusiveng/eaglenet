import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { Shipment } from "./Shipment";
import { User } from "../../users/entities/User";

export enum CustomsStatus {
  PENDING_DOCUMENTS = "pending_documents",
  UNDER_EXAMINATION = "under_examination",
  DUTY_ALREADY_PAID = "duty_paid",
  RELEASED = "released",
  EXIT_GATE = "exit_gate",
}

@Entity("customs_clearances")
export class CustomsClearance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "shipment_id" })
  shipmentId!: string;

  @OneToOne(() => Shipment)
  @JoinColumn({ name: "shipment_id" })
  shipment!: Shipment;

  @Column({
    type: "enum",
    enum: CustomsStatus,
    default: CustomsStatus.PENDING_DOCUMENTS,
  })
  status!: CustomsStatus;

  @Column({ name: "clearing_agent_id", nullable: true })
  clearingAgentId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "clearing_agent_id" })
  clearingAgent?: User;

  @Column({ type: "text", nullable: true })
  remarks?: string;

  @Column({ type: "jsonb", nullable: true })
  documents?: any[]; // Snapshot of document references

  @Column({ type: "timestamp", nullable: true, name: "released_at" })
  releasedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Shipment } from "./Shipment";

export enum PaymentStatus {
  SUCCESS = "SUCCESS",
  PENDING = "PENDING",
  FAILED = "FAILED",
}

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "payment_id", unique: true })
  paymentId!: string; // EGL-PAY-XXXXX

  @Column({ unique: true })
  reference!: string; // EGL-REF-XXXXX

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  /** Paystack authorization code / access_code returned after initiation */
  @Column({ name: "paystack_access_code", nullable: true })
  paystackAccessCode?: string;

  /** Paystack authorization_url for the checkout page */
  @Column({ name: "paystack_auth_url", nullable: true })
  paystackAuthUrl?: string;

  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "shipment_id", nullable: true })
  shipmentId?: string;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "shipment_id" })
  shipment?: Shipment;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

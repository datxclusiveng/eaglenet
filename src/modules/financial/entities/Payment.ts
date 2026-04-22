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
import { Shipment } from "../../shipments/entities/Shipment";
import { Invoice } from "./Invoice";

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export enum PaymentMethod {
  TRANSFER = "transfer",
  CASH = "cash",
  CARD = "card",
}

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "payment_id", unique: true })
  paymentId!: string;

  @Index()
  @Column({ unique: true })
  reference!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ default: "NGN" })
  currency!: string;

  @Column({
    name: "payment_method",
    type: "enum",
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod?: PaymentMethod;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  /** Timestamp when payment was confirmed / failed */
  @Column({ name: "processed_at", type: "timestamp", nullable: true })
  processedAt?: Date;

  /** The staff member who confirmed / processed the payment */
  @Column({ name: "processed_by_id", nullable: true })
  processedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "processed_by_id" })
  processedBy?: User;

  /** Optional notes or memo for the payment */
  @Column({ type: "text", nullable: true })
  notes?: string;

  /** Paystack-specific fields — kept for backward compat */
  @Column({ name: "paystack_access_code", nullable: true })
  paystackAccessCode?: string;

  @Column({ name: "paystack_auth_url", nullable: true })
  paystackAuthUrl?: string;

  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "shipment_id", nullable: true })
  shipmentId?: string;

  @ManyToOne(() => Shipment, { onDelete: "SET NULL" })
  @JoinColumn({ name: "shipment_id" })
  shipment?: Shipment;

  /** Optional — when this payment is linked to a formal invoice */
  @Index()
  @Column({ name: "invoice_id", nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, (inv) => inv.payments, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "invoice_id" })
  invoice?: Invoice;

  /** Optional URL to a physical receipt / proof of payment image */
  @Column({ name: "receipt_url", type: "text", nullable: true })
  receiptUrl?: string;

  /** For storing additional transaction data (teller numbers, bank names, etc.) */
  @Column({ type: "jsonb", nullable: true, default: {} })
  metadata?: any;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

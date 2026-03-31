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

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

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

  /**
   * Optional — when this payment is linked to a formal invoice.
   */
  @Index()
  @Column({ name: "invoice_id", nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, (inv) => inv.payments, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "invoice_id" })
  invoice?: Invoice;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

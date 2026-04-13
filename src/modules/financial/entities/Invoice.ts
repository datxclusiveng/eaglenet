import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";
import { Shipment } from "../../shipments/entities/Shipment";
import { Payment } from "./Payment";

export enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

@Entity("invoices")
export class Invoice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "invoice_number", unique: true })
  invoiceNumber!: string;

  @Index()
  @Column({ name: "shipment_id", nullable: true })
  shipmentId?: string;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "shipment_id" })
  shipment?: Shipment;

  @Column({ name: "client_name", nullable: true })
  clientName?: string;

  @Column({ name: "client_email", nullable: true })
  clientEmail?: string;

  @Column({ type: "jsonb", default: [] })
  items!: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  subtotal!: number;

  @Column({
    name: "tax_rate",
    type: "decimal",
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  taxRate!: number;

  @Column({
    name: "tax_amount",
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  taxAmount!: number;

  @Column({
    name: "total_amount",
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalAmount!: number;

  @Column({ default: "NGN" })
  currency!: string;

  @Column({
    type: "enum",
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status!: InvoiceStatus;

  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate?: string;

  @Column({ name: "paid_at", type: "timestamp", nullable: true })
  paidAt?: Date;

  @Column({ name: "payment_method", nullable: true })
  paymentMethod?: string;

  @Column({ name: "payment_reference", nullable: true })
  paymentReference?: string;

  @Column({ name: "pdf_url", type: "text", nullable: true })
  pdfUrl?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ name: "created_by" })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  creator!: User;

  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @OneToMany(() => Payment, (p) => p.invoice)
  payments!: Payment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}

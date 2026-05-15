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
import { BankAccount } from "./BankAccount";

export enum InvoiceStatus {
  DRAFT = "draft",
  PENDING_VERIFICATION = "pending_verification",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  SENT = "sent",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

export type InvoiceItem = {
  sn: number;
  description: string;
  quantity: number;
  price: number;
  total: number;
};

export type BankDetails = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankAddress?: string;
  sortCode?: string;
  swiftCode?: string;
  intermediaryBank?: string;
  intermediarySwift?: string;
  tin?: string;
  additionalInfo?: string;
};

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

  // ─── Client ──────────────────────────────────────────────────────────────
  @Column({ name: "client_name", nullable: true })
  clientName?: string;

  @Column({ name: "client_email", nullable: true })
  clientEmail?: string;

  // ─── Logistics Fields ─────────────────────────────────────────────────────
  @Column({ name: "file_number", nullable: true })
  fileNumber?: string;

  @Column({ name: "your_ref", nullable: true })
  yourRef?: string;

  @Column({ name: "awb_bl_number", nullable: true })
  awbBlNumber?: string;

  @Column({ name: "number_of_packages", type: "int", nullable: true })
  numberOfPackages?: number;

  @Column({
    name: "gross_weight",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  grossWeight?: number;

  @Column({
    name: "chargeable_weight",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  chargeableWeight?: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  cubit?: number;

  @Column({ name: "job_description", type: "text", nullable: true })
  jobDescription?: string;

  @Index()
  @Column({ name: "invoice_format", default: "naira" })
  invoiceFormat!: string;

  // ─── Items & Financials ──────────────────────────────────────────────────
  @Column({ type: "jsonb", default: [] })
  items!: InvoiceItem[];

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

  // ─── Bank Details ────────────────────────────────────────────────────────
  @Index()
  @Column({ name: "bank_account_id", nullable: true })
  bankAccountId?: string;

  @ManyToOne(() => BankAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "bank_account_id" })
  bankAccount?: BankAccount;

  @Column({ name: "bank_details", type: "jsonb", nullable: true, default: {} })
  bankDetails?: BankDetails;

  // ─── Approval / Signature ────────────────────────────────────────────────
  @Index()
  @Column({ name: "prepared_by_id", nullable: true })
  preparedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "prepared_by_id" })
  preparedBy?: User;

  @Column({ name: "prepared_at", type: "timestamp", nullable: true })
  preparedAt?: Date;

  @Index()
  @Column({ name: "verified_by_id", nullable: true })
  verifiedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "verified_by_id" })
  verifiedBy?: User;

  @Column({ name: "verified_at", type: "timestamp", nullable: true })
  verifiedAt?: Date;

  @Index()
  @Column({ name: "approved_by_id", nullable: true })
  approvedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approved_by_id" })
  approvedBy?: User;

  @Column({ name: "approved_at", type: "timestamp", nullable: true })
  approvedAt?: Date;

  @Column({ name: "issued_at", type: "timestamp", nullable: true })
  issuedAt?: Date;

  // ─── Creator & Lifecycle ─────────────────────────────────────────────────
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

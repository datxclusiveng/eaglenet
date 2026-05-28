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

export enum VoucherType {
  REQUEST_FOR_CASH = "REQUEST_FOR_CASH",
  PAYMENT_AUTHORITY = "PAYMENT_AUTHORITY",
  CASH_PAYMENT_VOUCHER = "CASH_PAYMENT_VOUCHER",
}

export enum VoucherStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export type VoucherItem = {
  sn: number;
  particulars: string;
  amount: number;
};

@Entity("finance_vouchers")
export class FinanceVoucher {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "voucher_number", unique: true })
  voucherNumber!: string;

  @Column({
    name: "voucher_type",
    type: "enum",
    enum: VoucherType,
  })
  voucherType!: VoucherType;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "text", nullable: true })
  purpose?: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  totalAmount?: number;

  @Column({
    type: "enum",
    enum: VoucherStatus,
    default: VoucherStatus.PENDING,
  })
  status!: VoucherStatus;

  // S3 URL for general receipts, attachments or backing files
  @Column({ name: "receipt_url", type: "text", nullable: true })
  receiptUrl?: string;

  // ─── Request for Cash specific fields ──────────────────────────────────────
  @Column({ name: "staff_id", nullable: true })
  staffId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "staff_id" })
  staff?: User;

  @Column({ name: "staff_signature_url", type: "text", nullable: true })
  staffSignatureUrl?: string;

  // ─── Authority of Payment Voucher (PV) specific fields ─────────────────────
  @Column({ name: "bank_transfer_date", type: "date", nullable: true })
  bankTransferDate?: string;

  @Column({ name: "beneficiary_name", nullable: true })
  beneficiaryName?: string;

  // ─── Cash Payment Voucher specific fields ──────────────────────────────────
  @Column({ type: "jsonb", nullable: true, default: [] })
  particulars?: VoucherItem[];

  @Column({ name: "amount_in_words", nullable: true })
  amountInWords?: string;

  @Column({ name: "items_description", type: "text", nullable: true })
  itemsDescription?: string;

  @Column({ name: "items_count", type: "int", nullable: true })
  itemsCount?: number;

  @Column({ name: "received_by_id", nullable: true })
  receivedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "received_by_id" })
  receivedBy?: User;

  @Column({ name: "received_by_name", nullable: true })
  receivedByName?: string;

  @Column({ name: "received_by_signature_url", type: "text", nullable: true })
  receivedBySignatureUrl?: string;

  @Column({ name: "issued_by_id", nullable: true })
  issuedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "issued_by_id" })
  issuedBy?: User;

  @Column({ name: "issued_by_signature_url", type: "text", nullable: true })
  issuedBySignatureUrl?: string;

  // ─── Approval / Authorization ──────────────────────────────────────────────
  @Column({ name: "authorized_by_id", nullable: true })
  authorizedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "authorized_by_id" })
  authorizedBy?: User;

  @Column({ name: "authorized_at", type: "timestamp", nullable: true })
  authorizedAt?: Date;

  @Column({ name: "authorized_signature_url", type: "text", nullable: true })
  authorizedSignatureUrl?: string;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason?: string;

  // ─── Creator ───────────────────────────────────────────────────────────────
  @Column({ name: "created_by_id" })
  createdById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

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
  DRAFT = "DRAFT",
  SENT = "SENT",
  PAID = "PAID",
  PARTIAL = "PARTIAL",
  CANCELLED = "CANCELLED",
}

@Entity("invoices")
export class Invoice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /**
   * Human-readable invoice number: EGL-INV-00042
   */
  @Index()
  @Column({ name: "invoice_number", unique: true })
  invoiceNumber!: string;

  /**
   * Nullable — invoices can exist independently of a shipment (standalone).
   */
  @Index()
  @Column({ name: "shipment_id", nullable: true })
  shipmentId?: string;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "shipment_id" })
  shipment?: Shipment;

  @Column({ type: "decimal", precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: "decimal", precision: 14, scale: 2, default: 0 })
  tax!: number;

  @Column({
    type: "enum",
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status!: InvoiceStatus;

  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ name: "created_by" })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  creator!: User;

  /**
   * Payments that have been applied to this invoice.
   */
  @OneToMany(() => Payment, (p) => p.invoice)
  payments!: Payment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}

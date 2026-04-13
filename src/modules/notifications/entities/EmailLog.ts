import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/User";
import { Shipment } from "../../shipments/entities/Shipment";
import { Invoice } from "../../financial/entities/Invoice";

export enum EmailStatus {
  SENT = "sent",
  FAILED = "failed",
  BOUNCED = "bounced",
}

@Entity("email_logs")
export class EmailLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "shipment_id", nullable: true })
  shipmentId?: string;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "shipment_id" })
  shipment?: Shipment;

  @Column({ name: "invoice_id", nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "invoice_id" })
  invoice?: Invoice;

  @Column({ name: "recipient_email" })
  recipientEmail!: string;

  @Column()
  subject!: string;

  @Column({ name: "template_used", nullable: true })
  templateUsed?: string;

  @Column({
    type: "enum",
    enum: EmailStatus,
    default: EmailStatus.SENT,
  })
  status!: EmailStatus;

  @Column({ name: "sent_by", nullable: true })
  sentById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "sent_by" })
  sentBy?: User;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: "sent_at" })
  sentAt!: Date;
}

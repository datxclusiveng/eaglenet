import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";
import { FinanceVoucher } from "./FinanceVoucher";
import { BankAccount } from "./BankAccount";

export enum TransactionNature {
  CASH = "cash",
  BANK = "bank",
}

export enum EntryType {
  DEBIT = "debit",
  CREDIT = "credit",
}

@Entity("cashbook_entries")
export class CashbookEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "reference_number", unique: true })
  referenceNumber!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({
    name: "nature_of_transaction",
    type: "enum",
    enum: TransactionNature,
  })
  natureOfTransaction!: TransactionNature;

  @Column({
    name: "entry_type",
    type: "enum",
    enum: EntryType,
  })
  entryType!: EntryType;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ name: "bank_name", nullable: true })
  bankName?: string;

  @Column({ name: "bank_account_id", nullable: true })
  bankAccountId?: string;

  @ManyToOne(() => BankAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "bank_account_id" })
  bankAccount?: BankAccount;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "voucher_id", nullable: true })
  voucherId?: string;

  @ManyToOne(() => FinanceVoucher, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "voucher_id" })
  voucher?: FinanceVoucher;

  @Column({ name: "created_by_id" })
  createdById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;

  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}

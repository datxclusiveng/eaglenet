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

export enum BankAccountType {
  LOCAL = "local",
  FOREIGN = "foreign",
}

@Entity("bank_accounts")
export class BankAccount {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "account_name" })
  accountName!: string;

  @Column({ name: "account_number" })
  accountNumber!: string;

  @Column({ name: "bank_name" })
  bankName!: string;

  @Column({ name: "bank_address", type: "text", nullable: true })
  bankAddress?: string;

  @Column({ name: "sort_code", nullable: true })
  sortCode?: string;

  @Column({ name: "swift_code", nullable: true })
  swiftCode?: string;

  @Column({ name: "intermediary_bank", nullable: true })
  intermediaryBank?: string;

  @Column({ name: "intermediary_swift", nullable: true })
  intermediarySwift?: string;

  @Column({ nullable: true })
  tin?: string;

  @Column({ name: "additional_info", type: "text", nullable: true })
  additionalInfo?: string;

  @Column({ default: "NGN" })
  currency!: string;

  @Index()
  @Column({
    name: "account_type",
    type: "enum",
    enum: BankAccountType,
    default: BankAccountType.LOCAL,
  })
  accountType!: BankAccountType;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "is_default", default: false })
  isDefault!: boolean;

  @Column({ name: "created_by_id", nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User;

  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}

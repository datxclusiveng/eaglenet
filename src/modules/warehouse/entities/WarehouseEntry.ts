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

export enum WarehouseDirection {
  INBOUND = "inbound",
  OUTBOUND = "outbound",
}

@Entity("warehouse_entries")
export class WarehouseEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ unique: true })
  sn!: string;

  @Column({
    type: "enum",
    enum: WarehouseDirection,
  })
  direction!: WarehouseDirection;

  @Column()
  clients!: string;

  @Column()
  awb!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  weight?: number;

  @Column({ type: "integer", nullable: true })
  pkgs?: number;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "date_in", type: "date" })
  dateIn!: string;

  @Column({ name: "date_out", type: "date", nullable: true })
  dateOut?: string;

  @Column({ type: "text", nullable: true })
  remarks?: string;

  @Column({ name: "created_by_id" })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
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

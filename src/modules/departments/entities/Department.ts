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

export enum DepartmentStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@Entity("departments")
export class Department {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ unique: true })
  name!: string;

  /** Department-level email address */
  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({
    type: "enum",
    enum: DepartmentStatus,
    default: DepartmentStatus.ACTIVE,
  })
  status!: DepartmentStatus;

  /** Denormalized staff count — updated when staff are added/removed */
  @Column({ name: "total_staff", default: 0 })
  totalStaff!: number;

  /** The department supervisor (a User in this department) */
  @Column({ name: "supervisor_id", nullable: true })
  supervisorId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "supervisor_id" })
  supervisor?: User;

  /** Who created this department (SuperAdmin) */
  @Column({ name: "created_by_id", nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User;

  /**
   * Metadata for custom workflows or department-specific settings.
   * Can store: { "require_approval": true, "default_carrier": "DHL" }
   */
  @Column({ type: "jsonb", nullable: true, default: {} })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}

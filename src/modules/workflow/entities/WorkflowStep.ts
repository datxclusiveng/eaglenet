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
import { Shipment } from "../../shipments/entities/Shipment";

export enum WorkflowStepStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Entity("workflow_steps")
export class WorkflowStep {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "shipment_id" })
  shipmentId!: string;

  @ManyToOne(() => Shipment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shipment_id" })
  shipment!: Shipment;

  @Column()
  name!: string;

  @Column({ name: "step_order", type: "int" })
  stepOrder!: number;

  @Column({
    type: "enum",
    enum: WorkflowStepStatus,
    default: WorkflowStepStatus.PENDING,
  })
  status!: WorkflowStepStatus;

  /**
   * Optional: Which department ID is responsible for clearing this step.
   */
  @Column({ name: "department_id", nullable: true })
  departmentId?: string;

  /**
   * Optional: User ID who updated/completed the step.
   */
  @Column({ name: "completed_by", nullable: true })
  completedBy?: string;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column({ type: "text", nullable: true })
  comments?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

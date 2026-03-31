import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export enum PermissionScope {
  OWN = "own",
  DEPARTMENT = "department",
  ALL = "all",
}

@Entity("permissions")
export class Permission {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  resource!: string; // e.g., "shipment", "document", "invoice"

  @Column()
  action!: string; // e.g., "create", "read", "update", "delete", "approve"

  @Column({
    type: "enum",
    enum: PermissionScope,
    default: PermissionScope.OWN,
  })
  scope!: PermissionScope;

  /**
   * ABAC Conditions using JSON logic.
   * Example: { "if": "invoice.amount > 10000", "go_to": "manager_approval" }
   */
  @Column({ type: "jsonb", nullable: true, default: {} })
  conditions?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

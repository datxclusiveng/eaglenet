import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";
import { Tracking } from "./Tracking";
import { Department } from "../../departments/entities/Department";
import { ShipmentLog } from "./ShipmentLog";

export enum ShipmentType {
  EXPORT = "export",
  IMPORT = "import",
}

export enum ShipmentStatus {
  PENDING = "pending",
  IN_TRANSIT = "in_transit",
  CUSTOMS = "customs",
  DELIVERED = "delivered",
  ON_HOLD = "on_hold",
  CANCELLED = "cancelled",
}

@Entity("shipments")
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Human-readable tracking / shipment ID e.g. EGL-EXP-240001 */
  @Index()
  @Column({ name: "tracking_number", unique: true })
  trackingNumber!: string;

  /** Internal description / reference for this shipment */
  @Column({ name: "shipment_name" })
  shipmentName!: string;

  /** Optional internal reference code */
  @Column({ name: "internal_reference", nullable: true })
  internalReference?: string;

  @Column({
    type: "enum",
    enum: ShipmentType,
  })
  type!: ShipmentType;

  @Index()
  @Column({
    type: "enum",
    enum: ShipmentStatus,
    default: ShipmentStatus.PENDING,
  })
  status!: ShipmentStatus;

  // ─── Client / Recipient ────────────────────────────────────────────────────
  @Column({ name: "client_name", nullable: true })
  clientName?: string;

  @Column({ name: "client_email", nullable: true })
  clientEmail?: string;

  @Column({ name: "client_phone", nullable: true })
  clientPhone?: string;

  // ─── Route ────────────────────────────────────────────────────────────────
  @Column({ name: "pickup_address", type: "text", nullable: true })
  pickupAddress?: string;

  @Column({ name: "delivery_address", type: "text", nullable: true })
  deliveryAddress?: string;

  @Column({ name: "origin_country", nullable: true })
  originCountry?: string;

  @Column({ name: "origin_city", nullable: true })
  originCity?: string;

  @Column({ name: "destination_country", nullable: true })
  destinationCountry?: string;

  @Column({ name: "destination_city", nullable: true })
  destinationCity?: string;

  // ─── Physical Details ──────────────────────────────────────────────────────
  @Column({
    name: "weight_kg",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  weightKg?: number;

  /**
   * Physical dimensions in cm: { length, width, height }
   */
  @Column({ type: "jsonb", nullable: true, default: {} })
  dimensions?: { length: number; width: number; height: number };

  @Column({
    name: "volume_cbm",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  volumeCbm?: number;

  // ─── Carrier / Flight Info ─────────────────────────────────────────────────
  @Column({ name: "airline_or_vessel", nullable: true })
  airlineOrVessel?: string;

  @Column({ name: "flight_or_voyage_number", nullable: true })
  flightOrVoyageNumber?: string;

  @Column({ name: "departure_date", type: "date", nullable: true })
  departureDate?: string;

  // ─── Dates ────────────────────────────────────────────────────────────────
  /** ETA (for tracking) */
  @Column({ type: "date", nullable: true })
  eta?: string;

  /** Expected delivery date (internal planning) */
  @Column({ name: "expected_delivery_date", type: "date", nullable: true })
  expectedDeliveryDate?: string;

  /** Set when status changes to DELIVERED */
  @Column({ name: "actual_delivery_date", type: "date", nullable: true })
  actualDeliveryDate?: string;

  // ─── Notes ────────────────────────────────────────────────────────────────
  @Column({ type: "text", nullable: true })
  description?: string;

  /** Internal staff notes — not shown to client */
  @Column({ name: "internal_notes", type: "text", nullable: true })
  internalNotes?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  // ─── Relationships ────────────────────────────────────────────────────────
  /** Originating / responsible department */
  @Index()
  @Column({ name: "department_id", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  /** Staff member assigned to handle / deliver the shipment */
  @Column({ name: "assigned_officer_id", nullable: true })
  assignedOfficerId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_officer_id" })
  assignedOfficer?: User;

  /** Staff member who created the shipment record */
  @Index()
  @Column({ name: "created_by_id", nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User;

  @Column({ name: "invoice_id", nullable: true })
  invoiceId?: string;

  @Column({ name: "customs_record_id", nullable: true })
  customsRecordId?: string;

  @Column({ name: "is_deleted", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;

  @OneToMany(() => Tracking, (tracking) => tracking.shipment)
  trackingUpdates!: Tracking[];

  @OneToMany(() => ShipmentLog, (log) => log.shipment)
  logs!: ShipmentLog[];

  /** Collaborating departments (cross-department visibility) */
  @ManyToMany(() => Department)
  @JoinTable({
    name: "shipment_collaborators",
    joinColumn: { name: "shipment_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "department_id", referencedColumnName: "id" },
  })
  collaborators!: Department[];
}

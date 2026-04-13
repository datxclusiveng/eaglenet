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
  AIR_FREIGHT = "air_freight",
  SEA_FREIGHT = "sea_freight",
}

export enum ShipmentStatus {
  PENDING = "pending",
  IN_TRANSIT = "in_transit",
  ARRIVED = "arrived",
  DELIVERED = "delivered",
  ON_HOLD = "on_hold",
  CANCELLED = "cancelled",
}

@Entity("shipments")
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "tracking_number", unique: true })
  trackingNumber!: string;

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

  @Column({ name: "client_name" })
  clientName!: string;

  @Column({ name: "client_email" })
  clientEmail!: string;

  @Column({ name: "client_phone" })
  clientPhone!: string;

  @Column({ name: "origin_country", nullable: true })
  originCountry?: string;

  @Column({ name: "origin_city", nullable: true })
  originCity?: string;

  @Column({ name: "destination_country", nullable: true })
  destinationCountry?: string;

  @Column({ name: "destination_city", nullable: true })
  destinationCity?: string;

  @Column({ type: "date", nullable: true })
  eta?: string;

  @Column({ name: "actual_arrival_date", type: "date", nullable: true })
  actualArrivalDate?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({
    name: "weight_kg",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  weightKg?: number;

  @Column({
    name: "volume_cbm",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  volumeCbm?: number;

  @Column({ name: "airline_or_vessel", nullable: true })
  airlineOrVessel?: string;

  @Column({ name: "flight_or_voyage_number", nullable: true })
  flightOrVoyageNumber?: string;

  @Column({ name: "departure_date", type: "date", nullable: true })
  departureDate?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ name: "assigned_officer_id", nullable: true })
  assignedOfficerId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_officer_id" })
  assignedOfficer?: User;

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

  @ManyToMany(() => Department)
  @JoinTable({
    name: "shipment_collaborators",
    joinColumn: { name: "shipment_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "department_id", referencedColumnName: "id" },
  })
  collaborators!: Department[];
}

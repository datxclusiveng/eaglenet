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
import { Service } from "./Service";
import { Tracking } from "./Tracking";
import { Payment } from "../../financial/entities/Payment";
import { Department } from "../../departments/entities/Department";
import { ShipmentLog } from "./ShipmentLog";
import { Document } from "../../documents/entities/Document";

export enum ShipmentStatus {
  ORDER_PLACED = "ORDER_PLACED",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  WAITING_TO_BE_SHIPPED = "WAITING_TO_BE_SHIPPED",
  SHIPPED = "SHIPPED",
  AVAILABLE_FOR_PICKUP = "AVAILABLE_FOR_PICKUP",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum CreationSource {
  CUSTOMER = "CUSTOMER",
  STAFF = "STAFF",
}

@Entity("shipments")
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: CreationSource,
    default: CreationSource.CUSTOMER,
    name: "creation_source",
  })
  creationSource!: CreationSource;

  @Column({ name: "is_external", default: false })
  isExternal!: boolean;

  @Index()
  @Column({ name: "shipping_id", unique: true })
  shippingId!: string; // EGL-SHIP-XXXXX

  @Index()
  @Column({ name: "tracking_id", unique: true })
  trackingId!: string; // EGL-TRK-XXXXX

  @Column({ name: "full_name" })
  fullName!: string;

  @Column()
  email!: string;

  @Column({ name: "phone_number" })
  phoneNumber!: string;

  @Column({ name: "pickup_address" })
  pickupAddress!: string;

  @Column({ name: "pickup_city" })
  pickupCity!: string;

  @Column({ name: "delivery_address" })
  deliveryAddress!: string;

  @Column({ name: "destination_city" })
  destinationCity!: string;

  @Column({ name: "preferred_pickup_date", type: "date" })
  preferredPickupDate!: string;

  @Column({ name: "preferred_pickup_time" })
  preferredPickupTime!: string;

  @Column({ name: "special_requirements", nullable: true, type: "text" })
  specialRequirements?: string;

  @Column({ name: "package_details", nullable: true, type: "text" })
  packageDetails?: string;

  @Column({
    name: "weight",
    nullable: true,
    type: "decimal",
    precision: 8,
    scale: 2,
  })
  weight?: number;

  @Index()
  @Column({
    type: "enum",
    enum: ShipmentStatus,
    default: ShipmentStatus.ORDER_PLACED,
  })
  status!: ShipmentStatus;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: "jsonb", nullable: true, default: {} })
  dynamicFields?: Record<string, any>;

  @Column({ name: "user_id", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;

  @Index()
  @Column({ name: "department_id", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  @Column({ name: "service_id", nullable: true })
  serviceId?: string;

  @ManyToOne(() => Service, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "service_id" })
  service?: Service;

  @Column({ nullable: true })
  origin?: string;

  @Column({ nullable: true })
  destination?: string;

  @Column({ name: "arrival_date", type: "date", nullable: true })
  arrivalDate?: string;

  @OneToMany(() => Tracking, (tracking) => tracking.shipment)
  trackingUpdates!: Tracking[];

  @OneToMany(() => Payment, (payment) => payment.shipment)
  payments!: Payment[];

  @OneToMany(() => ShipmentLog, (log) => log.shipment)
  logs!: ShipmentLog[];

  @OneToMany(() => Document, (doc) => doc.shipment)
  documents!: Document[];

  @ManyToMany(() => Department)
  @JoinTable({
    name: "shipment_collaborators",
    joinColumn: { name: "shipment_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "department_id", referencedColumnName: "id" },
  })
  collaborators!: Department[];
}

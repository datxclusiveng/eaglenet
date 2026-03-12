import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Service } from "./Service";
import { Tracking } from "./Tracking";
import { Payment } from "./Payment";

export enum ShipmentStatus {
  ORDER_PLACED = "ORDER_PLACED",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  WAITING_TO_BE_SHIPPED = "WAITING_TO_BE_SHIPPED",
  SHIPPED = "SHIPPED",
  AVAILABLE_FOR_PICKUP = "AVAILABLE_FOR_PICKUP",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

@Entity("shipments")
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "shipping_id", unique: true })
  shippingId!: string; // EGL-SHIP-XXXXX

  @Column({ name: "tracking_id", unique: true })
  trackingId!: string; // EGL-TRK-XXXXX

  // ── Customer details (captured at booking time) ──
  @Column({ name: "full_name" })
  fullName!: string;

  @Column()
  email!: string;

  @Column({ name: "phone_number" })
  phoneNumber!: string;

  // ── Route details ──
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

  // ── Package details (admin-enriched) ──
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

  // ── Status ──
  @Column({
    type: "enum",
    enum: ShipmentStatus,
    default: ShipmentStatus.ORDER_PLACED,
  })
  status!: ShipmentStatus;

  // ── Amount (what was charged) ──
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  amount!: number;

  // ── Relations ──
  @Column({ name: "user_id", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Service & Routing details ──
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
}

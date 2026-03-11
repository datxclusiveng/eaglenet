import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from "typeorm";
import { Shipment } from "./Shipment";

@Entity("tracking")
export class Tracking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "shipment_id" })
  shipmentId!: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.trackingUpdates, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shipment_id" })
  shipment!: Shipment;

  @Column()
  checkpoint!: string;

  @Column({ nullable: true })
  location?: string;

  @Column()
  status!: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  date!: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

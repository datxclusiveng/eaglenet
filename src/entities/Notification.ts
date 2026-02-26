import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum NotificationType {
  GENERIC = "GENERIC",
  SHIPMENT = "SHIPMENT",
  PAYMENT = "PAYMENT",
  ACCOUNT = "ACCOUNT",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id" })
  user_id!: string;

  @Column({
    type: "uuid",
    name: "actor_id",
    nullable: true,
  })
  actor_id?: string | null;

  @Column({
    type: "enum",
    enum: NotificationType,
    default: NotificationType.GENERIC,
  })
  type!: NotificationType;

  @Column()
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "jsonb", nullable: true })
  payload?: any;

  @Column({ name: "is_read", default: false })
  is_read!: boolean;

  @Column({ name: "delivered_at", nullable: true })
  delivered_at?: Date;

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date;
}

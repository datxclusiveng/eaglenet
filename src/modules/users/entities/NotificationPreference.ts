import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";

@Entity("notification_preferences")
export class NotificationPreference {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id" })
  userId!: string;

  @OneToOne(() => User, (user) => user.notificationPreferences, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ default: true })
  emailShipmentStatus!: boolean;

  @Column({ default: true })
  emailAssignments!: boolean;

  @Column({ default: true })
  emailFinancial!: boolean;

  @Column({ default: true })
  inAppShipmentStatus!: boolean;

  @Column({ default: true })
  inAppAssignments!: boolean;

  @Column({ default: true })
  inAppFinancial!: boolean;

  @Column({ name: "quiet_hours_enabled", default: false })
  quietHoursEnabled!: boolean;

  @Column({ name: "quiet_hours_start", nullable: true })
  quietHoursStart?: string; // HH:mm

  @Column({ name: "quiet_hours_end", nullable: true })
  quietHoursEnd?: string; // HH:mm

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

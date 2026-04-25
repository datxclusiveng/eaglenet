import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from "typeorm";
import { Exclude } from "class-transformer";
import { UserDepartmentRole } from "./UserDepartmentRole";
import { NotificationPreference } from "./NotificationPreference";
import { Shipment } from "../../shipments/entities/Shipment";

export enum UserRole {
  STAFF = "STAFF",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "first_name" })
  firstName!: string;

  @Column({ name: "last_name" })
  lastName!: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Index()
  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.STAFF,
  })
  role!: UserRole;

  @Column({ name: "phone_number", nullable: true })
  phoneNumber?: string;

  @Column({
    name: "outstanding_balance",
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
  })
  outstandingBalance!: number;

  /** Timestamp of the user's most recent successful login */
  @Column({ name: "last_login", type: "timestamp", nullable: true })
  lastLogin?: Date;

  /** IP address from the user's most recent successful login */
  @Column({ name: "last_login_ip", nullable: true })
  lastLoginIp?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;

  @Column({ name: "token_version", default: 0 })
  tokenVersion!: number;

  @Column({ name: "refresh_token", nullable: true })
  @Exclude()
  refreshToken?: string;

  @Column({ name: "refresh_token_expires_at", type: "timestamp", nullable: true })
  refreshTokenExpiresAt?: Date;

  @OneToMany(() => UserDepartmentRole, (udr) => udr.user)
  departmentRoles!: UserDepartmentRole[];

  @OneToOne(() => NotificationPreference, (pref) => pref.user)
  notificationPreferences?: NotificationPreference;

  @OneToMany(() => Shipment, (shipment) => shipment.assignedOfficer)
  assignedShipments!: Shipment[];

  @OneToMany(() => Shipment, (shipment) => shipment.createdBy)
  createdShipments!: Shipment[];
}

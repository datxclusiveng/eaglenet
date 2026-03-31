import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Exclude } from "class-transformer";
import { UserDepartmentRole } from "./UserDepartmentRole";

export enum UserRole {
  CUSTOMER = "CUSTOMER",
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
    default: UserRole.CUSTOMER,
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

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;

  @Column({ name: "refresh_token", nullable: true })
  @Exclude()
  refreshToken?: string;

  @Column({ name: "refresh_token_expires_at", type: "timestamp", nullable: true })
  refreshTokenExpiresAt?: Date;

  @OneToMany(() => UserDepartmentRole, (udr) => udr.user)
  departmentRoles!: UserDepartmentRole[];
}

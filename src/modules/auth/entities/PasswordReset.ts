import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/User";

@Entity("password_resets")
export class PasswordReset {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "email" })
  email!: string;

  @Column({ name: "code" })
  code!: string; // 6-digit OTP

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt!: Date;

  @Column({ name: "is_used", default: false })
  isUsed!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "email", referencedColumnName: "email" })
  user!: User;
}

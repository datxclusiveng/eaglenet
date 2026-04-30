
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";
import { Department } from "../../departments/entities/Department";
import { ChannelMember } from "./ChannelMember";
import { ChannelMessage } from "./ChannelMessage";

/**
 * A team chat channel (like a Slack channel).
 * Can be public (visible to all staff) or private (invite-only).
 * Optionally scoped to a department.
 */
@Entity("chat_channels")
export class ChatChannel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ unique: true })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "is_private", default: false })
  isPrivate!: boolean;

  @Column({ name: "created_by_id" })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;

  /** Optional — if set, channel is scoped to this department */
  @Column({ name: "department_id", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  @OneToMany(() => ChannelMember, (m) => m.channel)
  members!: ChannelMember[];

  @OneToMany(() => ChannelMessage, (m) => m.channel)
  messages!: ChannelMessage[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/User";
import { ChatChannel } from "./ChatChannel";

export enum ChannelRole {
  ADMIN = "admin",
  MEMBER = "member",
}

/**
 * Membership record linking a user to a channel.
 */
@Entity("channel_members")
@Index(["channelId", "userId"], { unique: true })
export class ChannelMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "channel_id" })
  channelId!: string;

  @ManyToOne(() => ChatChannel, (c) => c.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "channel_id" })
  channel!: ChatChannel;

  @Index()
  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    type: "enum",
    enum: ChannelRole,
    default: ChannelRole.MEMBER,
  })
  role!: ChannelRole;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt!: Date;
}

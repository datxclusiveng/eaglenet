import { AppDataSource } from "../../../../database/data-source";
import { ChatChannel } from "../entities/ChatChannel";
import { ChannelMember, ChannelRole } from "../entities/ChannelMember";
import { ChannelMessage } from "../entities/ChannelMessage";
import { MessageType } from "../entities/Message";
import { getIO } from "../../../socket";

const channelRepo = () => AppDataSource.getRepository(ChatChannel);
const memberRepo = () => AppDataSource.getRepository(ChannelMember);
const msgRepo = () => AppDataSource.getRepository(ChannelMessage);

// ─── Channel Management ───────────────────────────────────────────────────────

export async function createChannel(
  name: string,
  createdById: string,
  options: { description?: string; isPrivate?: boolean; departmentId?: string } = {}
): Promise<ChatChannel> {
  const channel = channelRepo().create({
    name: name.trim(),
    createdById,
    description: options.description,
    isPrivate: options.isPrivate || false,
    departmentId: options.departmentId,
  });
  await channelRepo().save(channel);

  // Auto-add creator as admin member
  await addMember(channel.id, createdById, ChannelRole.ADMIN);

  return channel;
}

export async function getChannelById(channelId: string): Promise<ChatChannel | null> {
  return channelRepo().findOne({
    where: { id: channelId },
    relations: ["createdBy", "department"],
  });
}

/**
 * List all channels a user is a member of.
 * For admins, also shows all public channels they haven't joined.
 */
export async function listUserChannels(userId: string): Promise<any[]> {
  const memberships = await memberRepo().find({
    where: { userId },
    relations: ["channel", "channel.department"],
  });

  return memberships.map((m) => ({
    channelId: m.channelId,
    name: m.channel.name,
    description: m.channel.description,
    isPrivate: m.channel.isPrivate,
    departmentId: m.channel.departmentId,
    department: m.channel.department?.name,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

// ─── Membership ───────────────────────────────────────────────────────────────

export async function addMember(
  channelId: string,
  userId: string,
  role: ChannelRole = ChannelRole.MEMBER
): Promise<ChannelMember> {
  // Upsert-safe: check if already a member
  const existing = await memberRepo().findOne({ where: { channelId, userId } });
  if (existing) return existing;

  const member = memberRepo().create({ channelId, userId, role });
  await memberRepo().save(member);
  return member;
}

export async function removeMember(channelId: string, userId: string): Promise<boolean> {
  const member = await memberRepo().findOne({ where: { channelId, userId } });
  if (!member) return false;
  await memberRepo().remove(member);
  return true;
}

export async function isMember(channelId: string, userId: string): Promise<boolean> {
  const count = await memberRepo().count({ where: { channelId, userId } });
  return count > 0;
}

export async function isChannelAdmin(channelId: string, userId: string): Promise<boolean> {
  const member = await memberRepo().findOne({ where: { channelId, userId, role: ChannelRole.ADMIN } });
  return !!member;
}

export async function listChannelMembers(channelId: string): Promise<any[]> {
  const members = await memberRepo().find({
    where: { channelId },
    relations: ["user"],
    order: { joinedAt: "ASC" },
  });

  return members.map((m) => ({
    userId: m.userId,
    name: `${m.user.firstName} ${m.user.lastName}`,
    email: m.user.email,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export async function sendChannelMessage(
  channelId: string,
  senderId: string,
  content: string,
  options: { messageType?: MessageType; attachmentUrl?: string; attachmentName?: string } = {}
): Promise<ChannelMessage> {
  const message = msgRepo().create({
    channelId,
    senderId,
    content,
    messageType: options.messageType || MessageType.TEXT,
    attachmentUrl: options.attachmentUrl,
    attachmentName: options.attachmentName,
    sentAt: new Date(),
  });

  await msgRepo().save(message);

  // Real-time broadcast to all channel members via socket room
  try {
    const io = getIO();
    io.to(`channel_${channelId}`).emit("channel_message", {
      id: message.id,
      channelId,
      senderId,
      content: message.content,
      messageType: message.messageType,
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName,
      sentAt: message.sentAt,
    });
  } catch {
    // Socket not ready — DB record still saved
  }

  return message;
}

export async function getChannelMessages(
  channelId: string,
  opts: { skip: number; take: number }
): Promise<[ChannelMessage[], number]> {
  return msgRepo()
    .createQueryBuilder("m")
    .leftJoinAndSelect("m.sender", "sender")
    .where("m.channelId = :channelId", { channelId })
    .andWhere("m.isDeleted = false")
    .orderBy("m.sentAt", "ASC")
    .skip(opts.skip)
    .take(opts.take)
    .getManyAndCount();
}

export async function deleteChannelMessage(
  messageId: string,
  senderId: string
): Promise<boolean> {
  const message = await msgRepo().findOne({ where: { id: messageId, senderId } });
  if (!message) return false;
  message.isDeleted = true;
  await msgRepo().save(message);
  return true;
}

import { AppDataSource } from "../../../../database/data-source";
import { Message, MessageType } from "../entities/Message";
import { Notification } from "../../notifications/entities/Notification";
import { NotificationType } from "../../notifications/entities/Notification";
import { getIO } from "../../../socket";

const msgRepo = () => AppDataSource.getRepository(Message);

/**
 * Build a deterministic thread ID from two user IDs.
 * Same thread ID regardless of who initiates the conversation.
 */
function buildThreadId(userAId: string, userBId: string): string {
  return `thread_${[userAId, userBId].sort().join("_")}`;
}

/**
 * Send a direct message from one staff member to another.
 * Persists to DB + pushes real-time event via Socket.IO.
 */
export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string,
  options: {
    messageType?: MessageType;
    attachmentUrl?: string;
    attachmentName?: string;
  } = {}
): Promise<Message> {
  const threadId = buildThreadId(senderId, recipientId);

  const message = msgRepo().create({
    senderId,
    recipientId,
    threadId,
    content,
    messageType: options.messageType || MessageType.TEXT,
    attachmentUrl: options.attachmentUrl,
    attachmentName: options.attachmentName,
    sentAt: new Date(),
  });

  await msgRepo().save(message);

  // Real-time delivery to recipient's socket room
  try {
    const io = getIO();
    io.to(`user_${recipientId}`).emit("new_message", {
      id: message.id,
      senderId,
      threadId,
      content: message.content,
      messageType: message.messageType,
      attachmentUrl: message.attachmentUrl,
      sentAt: message.sentAt,
    });
  } catch {
    // Socket not initialized or user offline — DB record still saved
  }

  // Persist an in-app notification for the recipient
  try {
    const notifRepo = AppDataSource.getRepository(Notification);
    const notif = notifRepo.create({
      userId: recipientId,
      title: "New Message",
      message: content.length > 80 ? content.substring(0, 80) + "…" : content,
      type: NotificationType.MESSAGE,
      relatedEntityType: "Message",
      relatedEntityId: message.id,
      actionUrl: `/messages/${threadId}`,
    });
    await notifRepo.save(notif);
  } catch {
    // Notification failure must not block messaging
  }

  return message;
}

/**
 * Get all messages in a thread (paginated, newest last).
 */
export async function getThread(
  userAId: string,
  userBId: string,
  opts: { skip: number; take: number }
): Promise<[Message[], number]> {
  const threadId = buildThreadId(userAId, userBId);

  return msgRepo()
    .createQueryBuilder("m")
    .leftJoinAndSelect("m.sender", "sender")
    .where("m.threadId = :threadId", { threadId })
    .andWhere("m.isDeleted = false")
    .orderBy("m.sentAt", "ASC")
    .skip(opts.skip)
    .take(opts.take)
    .getManyAndCount();
}

/**
 * Get inbox: all distinct threads for a user, with the last message and unread count.
 */
export async function getInbox(userId: string): Promise<any[]> {
  // Get the most recent message from each thread the user is part of
  const threads = await msgRepo()
    .createQueryBuilder("m")
    .leftJoinAndSelect("m.sender", "sender")
    .leftJoinAndSelect("m.recipient", "recipient")
    .where("(m.senderId = :uid OR m.recipientId = :uid)", { uid: userId })
    .andWhere("m.isDeleted = false")
    .orderBy("m.sentAt", "DESC")
    .getMany();

  // Group by threadId — keep only the latest message per thread
  const seen = new Set<string>();
  const latestPerThread: Message[] = [];
  for (const msg of threads) {
    if (!seen.has(msg.threadId)) {
      seen.add(msg.threadId);
      latestPerThread.push(msg);
    }
  }

  // For each thread, count unread messages (sent TO this user, not yet read)
  const inbox = await Promise.all(
    latestPerThread.map(async (msg) => {
      const unreadCount = await msgRepo().count({
        where: {
          threadId: msg.threadId,
          recipientId: userId,
          isDeleted: false,
        },
      });

      // Determine the other party
      const otherUser =
        msg.senderId === userId
          ? { id: msg.recipient?.id, name: `${msg.recipient?.firstName} ${msg.recipient?.lastName}`, email: msg.recipient?.email }
          : { id: msg.sender?.id, name: `${msg.sender?.firstName} ${msg.sender?.lastName}`, email: msg.sender?.email };

      return {
        threadId: msg.threadId,
        lastMessage: {
          id: msg.id,
          content: msg.content,
          messageType: msg.messageType,
          sentAt: msg.sentAt,
          senderId: msg.senderId,
        },
        with: otherUser,
        unreadCount,
      };
    })
  );

  return inbox;
}

/**
 * Mark a specific message as read.
 */
export async function markMessageAsRead(
  messageId: string,
  recipientId: string
): Promise<boolean> {
  const message = await msgRepo().findOneBy({ id: messageId, recipientId });
  if (!message || message.readAt) return false;

  message.readAt = new Date();
  await msgRepo().save(message);
  return true;
}

/**
 * Mark all messages in a thread as read for the given user.
 */
export async function markThreadAsRead(
  threadId: string,
  recipientId: string
): Promise<number> {
  const result = await msgRepo()
    .createQueryBuilder()
    .update(Message)
    .set({ readAt: new Date() })
    .where("threadId = :threadId", { threadId })
    .andWhere("recipientId = :recipientId", { recipientId })
    .andWhere("readAt IS NULL")
    .execute();

  return result.affected || 0;
}

/**
 * Soft-delete a message (only the sender can do this).
 */
export async function deleteMessage(
  messageId: string,
  senderId: string
): Promise<boolean> {
  const message = await msgRepo().findOneBy({ id: messageId, senderId });
  if (!message) return false;

  message.isDeleted = true;
  await msgRepo().save(message);
  return true;
}

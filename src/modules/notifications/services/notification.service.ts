import { AppDataSource } from "../../../../database/data-source";
import { Notification, NotificationType } from "../entities/Notification";
import { getIO } from "../../../socket";
import { paginate, parsePagination } from "../../../utils/helpers";

const notifRepo = () => AppDataSource.getRepository(Notification);

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
}

/**
 * Persist an in-app notification and push it to the user's socket room.
 * Fire-and-forget safe — never throws.
 */
export async function createNotification(dto: CreateNotificationDto): Promise<void> {
  try {
    const notif = notifRepo().create({
      userId: dto.userId,
      title: dto.title,
      message: dto.message,
      type: dto.type || NotificationType.SYSTEM,
      relatedEntityType: dto.relatedEntityType,
      relatedEntityId: dto.relatedEntityId,
      actionUrl: dto.actionUrl,
      isRead: false,
    });

    await notifRepo().save(notif);

    // Real-time push to user's socket room
    try {
      const io = getIO();
      io.to(`user_${dto.userId}`).emit("notification", notif);
    } catch {
      // Socket offline — notification still saved to DB
    }
  } catch (err) {
    console.error("[NotificationService] Failed to create notification:", err);
  }
}

/**
 * Get paginated notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  query: Record<string, any>
): Promise<{ data: Notification[]; meta: any }> {
  const { page, limit, skip } = parsePagination(query);
  const unreadOnly = query.unread === "true";

  const qb = notifRepo()
    .createQueryBuilder("n")
    .where("n.userId = :uid", { uid: userId })
    .orderBy("n.createdAt", "DESC")
    .skip(skip)
    .take(limit);

  if (unreadOnly) {
    qb.andWhere("n.isRead = false");
  }

  const [data, total] = await qb.getManyAndCount();

  return { data, meta: paginate(total, page, limit) };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return notifRepo().count({ where: { userId, isRead: false } });
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const notif = await notifRepo().findOneBy({ id: notificationId, userId });
  if (!notif || notif.isRead) return false;

  notif.isRead = true;
  notif.readAt = new Date();
  await notifRepo().save(notif);
  return true;
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await notifRepo()
    .createQueryBuilder()
    .update(Notification)
    .set({ isRead: true, readAt: new Date() })
    .where("userId = :userId", { userId })
    .andWhere("isRead = false")
    .execute();

  return result.affected || 0;
}

/**
 * Delete read notifications older than N days (housekeeping).
 */
export async function pruneOldNotifications(
  userId: string,
  olderThanDays = 30
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await notifRepo()
    .createQueryBuilder()
    .delete()
    .from(Notification)
    .where("userId = :userId", { userId })
    .andWhere("isRead = true")
    .andWhere("createdAt < :cutoff", { cutoff })
    .execute();

  return result.affected || 0;
}

import { AppDataSource } from "../../../../database/data-source";
import { Notification, NotificationType } from "../entities/Notification";
import { getIO } from "../../../socket";

/**
 * Persists an in-app notification and pushes it to the user's socket.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType = NotificationType.SYSTEM,
  actionUrl: string = ""
) {
  try {
    const repo = AppDataSource.getRepository(Notification);
    const notification = repo.create({
      userId,
      title,
      message,
      type,
      actionUrl,
    });

    await repo.save(notification);

    // REAL-TIME: Push to the user's room (user_<id>)
    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification", notification);
    } catch (ioErr) {
      // Socket not initialized or user not connected – that's fine for now.
    }

    return notification;
  } catch (err) {
    console.error("[sendPushNotification] Error:", err);
    return null;
  }
}

/**
 * Broadcasts a notification to all users or a specific role.
 */
export async function broadcastNotification(
  title: string,
  message: string,
  type: NotificationType = NotificationType.SYSTEM,
  actionUrl: string = ""
) {
  try {
    const userRepo = AppDataSource.getRepository("User"); // Dynamic string ref to avoid circular deps if needed
    const users = await (userRepo as any).find({ where: { isActive: true } });

    const notificationRepo = AppDataSource.getRepository(Notification);
    const notifications = users.map((user: any) =>
      notificationRepo.create({
        userId: user.id,
        title,
        message,
        type,
        actionUrl,
      })
    );

    await notificationRepo.save(notifications);

    // REAL-TIME: Emit to all connected users
    try {
      const io = getIO();
      io.emit("notification", { title, message, type, actionUrl }); // Generic broadcast event
    } catch (ioErr) {
      // Socket not initialized
    }

    return { count: notifications.length };
  } catch (err) {
    console.error("[broadcastNotification] Error:", err);
    return { count: 0 };
  }
}


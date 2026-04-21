import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  pruneOldNotifications,
} from "../services/notification.service";

// ─── GET /api/notifications ──────────────────────────────────────────────────────
export async function listNotifications(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { data, meta } = await getUserNotifications(user.id, req.query);
    return res.status(200).json({ status: "success", data, meta });
  } catch (err) {
    console.error("[NotificationController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/notifications/unread-count ────────────────────────────────────────
export async function unreadCount(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const count = await getUnreadCount(user.id);
    return res.status(200).json({ status: "success", data: { count } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── PATCH /api/notifications/:id/read ──────────────────────────────────────────
export async function markRead(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const notificationId = req.params.id as string;

    const updated = await markNotificationRead(notificationId, user.id);
    if (!updated) {
      return res.status(404).json({ status: "error", message: "Notification not found or already read." });
    }

    return res.status(200).json({ status: "success", message: "Notification marked as read." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── PATCH /api/notifications/read-all ──────────────────────────────────────────
export async function markAllRead(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const count = await markAllNotificationsRead(user.id);
    return res.status(200).json({ status: "success", data: { markedRead: count } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── DELETE /api/notifications/prune ────────────────────────────────────────────
export async function prune(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const days = parseInt((req.query.days as string) || "30");
    const deleted = await pruneOldNotifications(user.id, days);
    return res.status(200).json({ status: "success", data: { deleted } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

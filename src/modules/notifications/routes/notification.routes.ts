import { Router } from "express";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  prune,
} from "../controllers/notification.controller";
import { auth } from "../../../middleware/auth.middleware";

const router = Router();

// All notification routes require authentication
router.use(...auth);

/**
 * GET /api/notifications
 * Get paginated notifications for the authenticated user
 * Query: ?page&limit&unread=true
 */
router.get("/", listNotifications);

/**
 * GET /api/notifications/unread-count
 * Returns the number of unread notifications
 */
router.get("/unread-count", unreadCount);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch("/read-all", markAllRead);

/**
 * PATCH /api/notifications/:id/read
 * Mark a specific notification as read
 */
router.patch("/:id/read", markRead);

/**
 * DELETE /api/notifications/prune
 * Delete old read notifications
 * Query: ?days=30 (default: 30)
 */
router.delete("/prune", prune);

export default router;

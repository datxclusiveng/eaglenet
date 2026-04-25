import { Router } from "express";
import {
  inbox,
  threadMessages,
  send,
  markRead,
  markThreadRead,
  remove,
} from "../controllers/message.controller";
import { auth } from "../../../middleware/auth.middleware";
import { uploadMiddleware, validateFileContent } from "../../../middleware/upload.middleware";

const router = Router();

// All messaging routes require authentication
router.use(...auth);

/**
 * GET /api/messages/inbox
 * Returns all conversation threads for the current user, with last message + unread count
 */
router.get("/inbox", inbox);

/**
 * GET /api/messages/thread/:userId
 * Paginated message history with a specific user
 * Query: ?page&limit
 */
router.get("/thread/:userId", threadMessages);

/**
 * POST /api/messages
 * Send a new message (supports text + optional file attachment)
 * Body (form-data): { recipientId, content?, messageType? }
 * File: optional attachment (field name: "attachment")
 */
router.post("/", uploadMiddleware.single("attachment"), validateFileContent, send);

/**
 * PATCH /api/messages/:id/read
 * Mark a specific message as read
 */
router.patch("/:id/read", markRead);

/**
 * PATCH /api/messages/thread/:userId/read
 * Mark all messages in a thread as read
 */
router.patch("/thread/:userId/read", markThreadRead);

/**
 * DELETE /api/messages/:id
 * Soft-delete a message (sender only)
 */
router.delete("/:id", remove);

export default router;

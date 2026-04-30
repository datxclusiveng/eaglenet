import { Router } from "express";
import {
  createChannelController,
  listUserChannelsController,
  getChannelController,
  getChannelMessagesController,
  sendChannelMessageController,
  addMemberController,
  removeMemberController,
  listMembersController,
  deleteChannelMessageController,
} from "../controllers/channel.controller";
import { auth } from "../../../middleware/auth.middleware";
import { uploadMiddleware, validateFileContent } from "../../../middleware/upload.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { 
  createChannelSchema, 
  sendChannelMessageSchema, 
  uuidParamSchema, 
  userIdParamSchema 
} from "../../../utils/validators";

const router = Router();

// All channel routes require authentication
router.use(...auth);

/**
 * POST /api/channels
 * Create a new channel. Creator is auto-added as admin.
 * Body: { name, description?, isPrivate?, departmentId? }
 */
router.post("/", validate(createChannelSchema), createChannelController);

/**
 * GET /api/channels
 * List all channels the current user is a member of.
 */
router.get("/", listUserChannelsController);

/**
 * GET /api/channels/:id
 * Get channel details. Private channels: members only.
 */
router.get("/:id", validate(uuidParamSchema), getChannelController);

/**
 * GET /api/channels/:id/messages
 * Paginated message history for a channel (members only).
 * Query: ?page=1&limit=50
 */
router.get("/:id/messages", validate(uuidParamSchema), getChannelMessagesController);

/**
 * POST /api/channels/:id/messages
 * Send a message to a channel (members only).
 * Supports optional file attachment (field: "attachment").
 */
router.post(
  "/:id/messages",
  validate(uuidParamSchema),
  uploadMiddleware.single("attachment"),
  validateFileContent,
  validate(sendChannelMessageSchema),
  sendChannelMessageController
);

/**
 * DELETE /api/channels/:id/messages/:messageId
 * Soft-delete a channel message (sender only).
 */
router.delete("/:id/messages/:messageId", deleteChannelMessageController);

/**
 * GET /api/channels/:id/members
 * List all members of a channel.
 */
router.get("/:id/members", validate(uuidParamSchema), listMembersController);

/**
 * POST /api/channels/:id/members
 * Add a member to the channel. Requires channel admin or system admin.
 * Body: { userId, role? (admin|member) }
 */
router.post("/:id/members", validate(uuidParamSchema), addMemberController);

/**
 * DELETE /api/channels/:id/members/:userId
 * Remove a member. Users can remove themselves; admins can remove anyone.
 */
router.delete("/:id/members/:userId", validate(uuidParamSchema), validate(userIdParamSchema), removeMemberController);

export default router;

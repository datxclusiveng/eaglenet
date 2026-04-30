import { Request, Response } from "express";
import { User, UserRole } from "../../users/entities/User";
import {
  createChannel,
  getChannelById,
  listUserChannels,
  addMember,
  removeMember,
  isMember,
  isChannelAdmin,
  listChannelMembers,
  sendChannelMessage,
  getChannelMessages,
  deleteChannelMessage,
} from "../services/channel.service";
import { ChannelRole } from "../entities/ChannelMember";
import { MessageType } from "../entities/Message";
import { uploadFile } from "../../../utils/storage.service";
import { parsePagination, paginate, sanitizeUser } from "../../../utils/helpers";
import { createAuditLog, AuditAction } from "../../audit/services/audit.service";

// ─── POST /api/channels ────────────────────────────────────────────────────────
export async function createChannelController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { name, description, isPrivate, departmentId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ status: "error", message: "Channel name is required." });
    }

    const channel = await createChannel(name, user.id, { description, isPrivate, departmentId });

    createAuditLog({
      entityType: "ChatChannel",
      entityId: channel.id,
      action: AuditAction.CREATE,
      actionDetails: { name, isPrivate, departmentId },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(channel, "Channel created successfully.");
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ status: "error", message: "A channel with this name already exists." });
    }
    console.error("[ChannelController.create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/channels ────────────────────────────────────────────────────────
export async function listUserChannelsController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channels = await listUserChannels(user.id);
    return (res as any).success(channels);
  } catch (err) {
    console.error("[ChannelController.list]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/channels/:id ─────────────────────────────────────────────────────
export async function getChannelController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channelId = req.params.id as string;

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    // Private channels: only members can view
    if (channel.isPrivate && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      const member = await isMember(channelId, user.id);
      if (!member) {
        return res.status(403).json({ status: "error", message: "You are not a member of this channel." });
      }
    }

    return (res as any).success(channel);
  } catch (err) {
    console.error("[ChannelController.get]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/channels/:id/messages ───────────────────────────────────────────
export async function getChannelMessagesController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channelId = req.params.id as string;
    const { page, limit, skip } = parsePagination(req.query);

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    // Must be a member to read messages
    if (!(await isMember(channelId, user.id)) &&
        user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ status: "error", message: "You are not a member of this channel." });
    }

    const [messages, total] = await getChannelMessages(channelId, { skip, take: limit });

    const formatted = messages.map((m) => ({
      id: m.id,
      content: m.content,
      messageType: m.messageType,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      sentAt: m.sentAt,
      sender: m.sender
        ? { id: m.sender.id, name: `${m.sender.firstName} ${m.sender.lastName}`, email: m.sender.email }
        : null,
    }));

    return (res as any).success(formatted, "Messages retrieved.", paginate(total, page, limit));
  } catch (err) {
    console.error("[ChannelController.messages]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── POST /api/channels/:id/messages ──────────────────────────────────────────
export async function sendChannelMessageController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channelId = req.params.id as string;
    const { content, messageType } = req.body;

    if (!content && !req.file) {
      return res.status(400).json({ status: "error", message: "Message content or attachment is required." });
    }

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    if (!(await isMember(channelId, user.id))) {
      return res.status(403).json({ status: "error", message: "You are not a member of this channel." });
    }

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let type = (messageType as MessageType) || MessageType.TEXT;

    if (req.file) {
      const uploaded = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "channel-messages");
      attachmentUrl = uploaded.url;
      attachmentName = req.file.originalname;
      type = MessageType.FILE;
    }

    const message = await sendChannelMessage(channelId, user.id, content || "", {
      messageType: type,
      attachmentUrl,
      attachmentName,
    });

    return (res as any).success(message, "Message sent.");
  } catch (err) {
    console.error("[ChannelController.sendMessage]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── POST /api/channels/:id/members ───────────────────────────────────────────
export async function addMemberController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channelId = req.params.id as string;
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({ status: "error", message: "userId is required." });
    }

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    // Only channel admin or system admin can add members
    const callerIsAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    if (!callerIsAdmin && !(await isChannelAdmin(channelId, user.id))) {
      return res.status(403).json({ status: "error", message: "Only channel admins can add members." });
    }

    const memberRole = role === ChannelRole.ADMIN ? ChannelRole.ADMIN : ChannelRole.MEMBER;
    const member = await addMember(channelId, userId, memberRole);

    createAuditLog({
      entityType: "ChatChannel",
      entityId: channelId,
      action: AuditAction.UPDATE,
      actionDetails: { event: "member_added", targetUserId: userId, role: memberRole },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(member, "Member added successfully.");
  } catch (err) {
    console.error("[ChannelController.addMember]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── DELETE /api/channels/:id/members/:userId ─────────────────────────────────
export async function removeMemberController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channelId = req.params.id as string;
    const targetUserId = req.params.userId as string;

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    // Allow self-leave OR channel admin / system admin
    const isSelf = user.id === targetUserId;
    const callerIsAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    if (!isSelf && !callerIsAdmin && !(await isChannelAdmin(channelId, user.id))) {
      return res.status(403).json({ status: "error", message: "Insufficient permissions." });
    }

    const removed = await removeMember(channelId, targetUserId);
    if (!removed) {
      return res.status(404).json({ status: "error", message: "Member not found in this channel." });
    }

    createAuditLog({
      entityType: "ChatChannel",
      entityId: channelId,
      action: AuditAction.UPDATE,
      actionDetails: { event: "member_removed", targetUserId: targetUserId },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "Member removed.");
  } catch (err) {
    console.error("[ChannelController.removeMember]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/channels/:id/members ────────────────────────────────────────────
export async function listMembersController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const channelId = req.params.id as string;

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    if (!(await isMember(channelId, user.id)) &&
        user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ status: "error", message: "You are not a member of this channel." });
    }

    const members = await listChannelMembers(channelId);
    const sanitized = members.map(m => ({ ...m, user: sanitizeUser(m.user) }));
    return (res as any).success(sanitized);
  } catch (err) {
    console.error("[ChannelController.listMembers]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── DELETE /api/channels/:id/messages/:messageId ─────────────────────────────
export async function deleteChannelMessageController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const messageId = req.params.messageId as string;

    const deleted = await deleteChannelMessage(messageId, user.id);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Message not found or you are not the sender." });
    }

    createAuditLog({
      entityType: "ChannelMessage",
      entityId: messageId,
      action: AuditAction.DELETE,
      actionDetails: { event: "message_soft_delete" },
      performedBy: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return (res as any).success(null, "Message deleted.");
  } catch (err) {
    console.error("[ChannelController.deleteMessage]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { MessageType } from "../entities/Message";
import {
  sendMessage,
  getThread,
  getInbox,
  markMessageAsRead,
  markThreadAsRead,
  deleteMessage,
} from "../services/message.service";
import { uploadFile } from "../../../utils/storage.service";
import { parsePagination } from "../../../utils/helpers";
import { AppDataSource } from "../../../../database/data-source";
import { User as UserEntity } from "../../users/entities/User";

// ─── GET /api/messages/inbox ────────────────────────────────────────────────────
export async function inbox(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const threads = await getInbox(user.id);
    return res.status(200).json({ status: "success", data: threads });
  } catch (err) {
    console.error("[MessageController.inbox]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── GET /api/messages/thread/:userId ──────────────────────────────────────────
export async function threadMessages(req: Request, res: Response) {
  try {
    const me = (req as any).user as User;
    const otherId = req.params.userId as string;
    const { skip, limit, page } = parsePagination(req.query) as any;

    // Verify the other user exists
    const other = await AppDataSource.getRepository(UserEntity).findOne({
      where: { id: otherId, isActive: true },
    });
    if (!other) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }

    const [messages, total] = await getThread(me.id, otherId, { skip, take: limit });

    // Auto-mark messages sent to me as read
    const threadId = [me.id, otherId].sort().join("_");
    markThreadAsRead(`thread_${threadId}`, me.id).catch(console.error);

    return res.status(200).json({
      status: "success",
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[MessageController.thread]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── POST /api/messages ─────────────────────────────────────────────────────────
export async function send(req: Request, res: Response) {
  try {
    const sender = (req as any).user as User;
    const { recipientId, content, messageType } = req.body;

    if (!recipientId) {
      return res.status(400).json({ status: "error", message: "recipientId is required." });
    }
    if (!content && !req.file) {
      return res.status(400).json({ status: "error", message: "Message content or attachment is required." });
    }

    // Verify recipient exists
    const recipient = await AppDataSource.getRepository(UserEntity).findOne({
      where: { id: recipientId, isActive: true },
    });
    if (!recipient) {
      return res.status(404).json({ status: "error", message: "Recipient not found." });
    }
    if (recipientId === sender.id) {
      return res.status(400).json({ status: "error", message: "Cannot send a message to yourself." });
    }

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let type = (messageType as MessageType) || MessageType.TEXT;

    // Handle file attachment
    if (req.file) {
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        "messages"
      );
      attachmentUrl = uploaded.url;
      attachmentName = req.file.originalname;
      type = MessageType.FILE;
    }

    const message = await sendMessage(sender.id, recipientId, content || "", {
      messageType: type,
      attachmentUrl,
      attachmentName,
    });

    return res.status(201).json({ status: "success", data: message });
  } catch (err) {
    console.error("[MessageController.send]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── PATCH /api/messages/:id/read ───────────────────────────────────────────────
export async function markRead(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const messageId = req.params.id as string;

    const updated = await markMessageAsRead(messageId, user.id);
    if (!updated) {
      return res.status(404).json({ status: "error", message: "Message not found or already read." });
    }

    return res.status(200).json({ status: "success", message: "Message marked as read." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── PATCH /api/messages/thread/:userId/read ────────────────────────────────────
export async function markThreadRead(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const otherId = req.params.userId as string;
    const threadId = `thread_${[user.id, otherId].sort().join("_")}`;

    const count = await markThreadAsRead(threadId, user.id);
    return res.status(200).json({ status: "success", data: { markedRead: count } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

// ─── DELETE /api/messages/:id ───────────────────────────────────────────────────
export async function remove(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const messageId = req.params.id as string;

    const deleted = await deleteMessage(messageId, user.id);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Message not found or you are not the sender." });
    }

    return res.status(200).json({ status: "success", message: "Message deleted." });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

import { AppDataSource } from "../../../../database/data-source";
import { ChatInvite, InviteStatus } from "../entities/ChatInvite";
import { getIO } from "../../../socket";
import { Notification, NotificationType } from "../../notifications/entities/Notification";

const inviteRepo = () => AppDataSource.getRepository(ChatInvite);

export async function sendInvite(senderId: string, recipientId: string): Promise<ChatInvite> {
  if (senderId === recipientId) {
    throw new Error("You cannot invite yourself.");
  }

  // Check if an invite already exists (any status)
  const existing = await inviteRepo().findOne({
    where: [
      { senderId, recipientId },
      { senderId: recipientId, recipientId: senderId }
    ]
  });

  if (existing) {
    if (existing.status === InviteStatus.ACCEPTED) {
      throw new Error("You already have an active chat connection.");
    }
    if (existing.status === InviteStatus.PENDING) {
      throw new Error("A pending invitation already exists.");
    }
    // If rejected, we allow the original sender or recipient to "re-invite" by resetting it
    existing.senderId = senderId;
    existing.recipientId = recipientId;
    existing.status = InviteStatus.PENDING;
    await inviteRepo().save(existing);
    
    await notifyInvite(existing);
    return existing;
  }

  const invite = inviteRepo().create({
    senderId,
    recipientId,
    status: InviteStatus.PENDING,
  });

  await inviteRepo().save(invite);
  await notifyInvite(invite);
  
  return invite;
}

async function notifyInvite(invite: ChatInvite) {
  try {
    const io = getIO();
    io.to(`user_${invite.recipientId}`).emit("chat_invite_received", invite);
    
    // Also create in-app notification
    const notifRepo = AppDataSource.getRepository(Notification);
    const notif = notifRepo.create({
      userId: invite.recipientId,
      title: "Chat Invitation",
      message: "Someone wants to start a direct chat with you.",
      type: NotificationType.SYSTEM,
      relatedEntityType: "ChatInvite",
      relatedEntityId: invite.id,
      actionUrl: "/messages/invites",
    });
    await notifRepo.save(notif);
  } catch {}
}

export async function respondToInvite(inviteId: string, userId: string, accept: boolean): Promise<ChatInvite> {
  const invite = await inviteRepo().findOne({
    where: { id: inviteId, recipientId: userId }
  });

  if (!invite) {
    throw new Error("Invitation not found or you are not the recipient.");
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new Error("This invitation has already been processed.");
  }

  invite.status = accept ? InviteStatus.ACCEPTED : InviteStatus.REJECTED;
  await inviteRepo().save(invite);

  // Notify sender
  try {
    const io = getIO();
    io.to(`user_${invite.senderId}`).emit("chat_invite_responded", {
      inviteId,
      status: invite.status,
    });
  } catch {}

  return invite;
}

export async function checkConnection(userAId: string, userBId: string): Promise<boolean> {
  const invite = await inviteRepo().findOne({
    where: [
      { senderId: userAId, recipientId: userBId, status: InviteStatus.ACCEPTED },
      { senderId: userBId, recipientId: userAId, status: InviteStatus.ACCEPTED }
    ]
  });
  return !!invite;
}

export async function listPendingInvites(userId: string): Promise<ChatInvite[]> {
  return inviteRepo().find({
    where: { recipientId: userId, status: InviteStatus.PENDING },
    relations: ["sender"],
  });
}

import { Request, Response } from "express";
import { User } from "../../users/entities/User";
import { 
  sendInvite, 
  respondToInvite, 
  listPendingInvites 
} from "../services/invite.service";
import { sanitizeUser } from "../../../utils/helpers";

export async function sendInviteController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ status: "error", message: "recipientId is required." });
    }

    const invite = await sendInvite(user.id, recipientId);
    return (res as any).success(invite, "Chat invitation sent.");
  } catch (err: any) {
    return res.status(400).json({ status: "error", message: err.message });
  }
}

export async function respondToInviteController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { inviteId, accept } = req.body;

    if (!inviteId || accept === undefined) {
      return res.status(400).json({ status: "error", message: "inviteId and accept (boolean) are required." });
    }

    const invite = await respondToInvite(inviteId, user.id, accept);
    const message = accept ? "Invitation accepted. You can now chat." : "Invitation rejected.";
    return (res as any).success(invite, message);
  } catch (err: any) {
    return res.status(400).json({ status: "error", message: err.message });
  }
}

export async function listPendingInvitesController(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const invites = await listPendingInvites(user.id);
    
    const sanitized = invites.map(i => ({
      ...i,
      sender: sanitizeUser(i.sender)
    }));

    return (res as any).success(sanitized);
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
}

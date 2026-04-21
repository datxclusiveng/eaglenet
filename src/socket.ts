import { Server as HTTPServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/data-source";
import { User } from "./modules/users/entities/User";

let io: IOServer | null = null;

// Track online user IDs → set of socket IDs
const onlineUsers = new Map<string, Set<string>>();

/**
 * Initialize Socket.IO with JWT handshake authentication.
 * Clients must connect with: io(url, { auth: { token: "Bearer <jwt>" } })
 *
 * Rooms structure:
 *   user_<id>           — personal room (notifications, DMs)
 *   dept_<departmentId> — department shipment updates
 */
export const initSocket = (httpServer: HTTPServer) => {
  io = new IOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // ── Auth Middleware ──────────────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const tokenRaw = socket.handshake.auth?.token as string | undefined;
      if (!tokenRaw)
        return next(new Error("Authentication error: token required"));

      const token = tokenRaw.startsWith("Bearer ")
        ? tokenRaw.split(" ")[1]
        : tokenRaw;

      if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET not configured");
        return next(new Error("Server configuration error"));
      }

      let payload: any;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return next(new Error("Authentication error: invalid token"));
      }

      const userId = payload?.id;
      if (!userId)
        return next(new Error("Authentication error: invalid token payload"));

      if (!(AppDataSource as any).isInitialized) {
        console.error("AppDataSource not initialized yet");
        return next(new Error("Server not ready"));
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ["departmentRoles"],
      });
      if (!user) return next(new Error("Authentication error: user not found"));

      socket.data.user = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
      };

      // Join personal notification room
      socket.join(`user_${user.id}`);

      // Join each department room for shipment updates
      for (const udr of user.departmentRoles || []) {
        socket.join(`dept_${udr.departmentId}`);
      }

      return next();
    } catch (err) {
      console.error("Socket auth middleware error:", err);
      return next(new Error("Authentication error"));
    }
  });

  // ── Connection Handlers ──────────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId = socket.data?.user?.id as string | undefined;
    console.log(`Socket connected: ${socket.id} (user=${userId || "unknown"})`);

    // Track this socket in the online users map
    if (userId) {
      if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
      onlineUsers.get(userId)!.add(socket.id);

      // Broadcast presence to all connected clients
      io!.emit("user_online", { userId });
    }

    // ── Typing indicators ──────────────────────────────────────────────────────
    socket.on("typing_start", (data: { recipientId: string }) => {
      if (!userId || !data.recipientId) return;
      socket.to(`user_${data.recipientId}`).emit("typing_start", { senderId: userId });
    });

    socket.on("typing_stop", (data: { recipientId: string }) => {
      if (!userId || !data.recipientId) return;
      socket.to(`user_${data.recipientId}`).emit("typing_stop", { senderId: userId });
    });

    // ── Join a department room (for real-time shipment updates) ────────────────
    socket.on("join_department", (deptId: string) => {
      if (!deptId) return;
      socket.join(`dept_${deptId}`);
    });

    socket.on("leave_department", (deptId: string) => {
      socket.leave(`dept_${deptId}`);
    });

    // ── Ping ──────────────────────────────────────────────────────────────────
    socket.on("ping", (cb: (ack: string) => void) => {
      if (typeof cb === "function") cb("pong");
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} reason=${reason}`);

      if (userId) {
        const sockets = onlineUsers.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUsers.delete(userId);
            io!.emit("user_offline", { userId });
          }
        }
      }
    });
  });
};

export const getIO = (): IOServer => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

/**
 * Check if a user has at least one active socket connection.
 */
export const isUserOnline = (userId: string): boolean => {
  return (onlineUsers.get(userId)?.size || 0) > 0;
};

/**
 * Emit a shipment status update event to all users in a department room.
 */
export const emitShipmentUpdate = (
  departmentId: string,
  payload: { shipmentId: string; trackingNumber: string; status: string; updatedBy: string }
) => {
  try {
    getIO().to(`dept_${departmentId}`).emit("shipment_updated", payload);
  } catch {
    // IO not ready
  }
};

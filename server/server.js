require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const User = require("./models/User");
const RoomMessage = require("./models/RoomMessage");
const PrivateMessage = require("./models/PrivateMessage");
const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("io", io);
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "../public")));
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "TeenVerse", time: new Date().toISOString() });
});

const connected = new Map();

function onlineList() {
  return [...connected.values()].map(({ socketIds, userId, ...safe }) => safe);
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeRoom(name) {
  return String(name || "General").trim().slice(0, 40) || "General";
}

async function roomHistory(room) {
  const rows = await RoomMessage.find({ room })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows.reverse().map((row) => ({
    id: row._id.toString(),
    username: row.username,
    role: row.role,
    avatarDataUrl: row.avatarDataUrl,
    message: row.message,
    room: row.room,
    time: formatTime(row.createdAt),
    createdAt: row.createdAt
  }));
}

async function privateHistory(userId, otherId) {
  const rows = await PrivateMessage.find({
    $or: [
      { senderId: userId, receiverId: otherId },
      { senderId: otherId, receiverId: userId }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows.reverse();
}

async function conversationList(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));

  const rows = await PrivateMessage.aggregate([
    {
      $match: {
        $or: [{ senderId: id }, { receiverId: id }]
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        mine: { $eq: ["$senderId", id] },
        otherId: {
          $cond: [{ $eq: ["$senderId", id] }, "$receiverId", "$senderId"]
        },
        otherUsername: {
          $cond: [
            { $eq: ["$senderId", id] },
            "$receiverUsername",
            "$senderUsername"
          ]
        }
      }
    },
    {
      $group: {
        _id: "$otherId",
        username: { $first: "$otherUsername" },
        message: { $first: "$message" },
        mine: { $first: "$mine" },
        read: { $first: "$read" },
        createdAt: { $first: "$createdAt" }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 50 }
  ]);

  return rows.map((row) => ({
    username: row.username,
    message: row.message,
    mine: row.mine,
    read: row.read,
    time: formatTime(row.createdAt),
    createdAt: row.createdAt
  }));
}

function addConnection(user, socketId) {
  const existing = connected.get(user.usernameLower);
  const socketIds = existing?.socketIds || new Set();
  socketIds.add(socketId);

  connected.set(user.usernameLower, {
    socketIds,
    userId: user._id.toString(),
    username: user.username,
    role: user.role,
    age: user.age,
    gender: user.gender,
    country: user.country,
    bio: user.bio,
    mood: user.mood,
    relationship: user.relationship,
    avatarDataUrl: user.avatarDataUrl
  });
}

function removeConnection(usernameLower, socketId) {
  const existing = connected.get(usernameLower);
  if (!existing) return;

  existing.socketIds.delete(socketId);
  if (existing.socketIds.size === 0) {
    connected.delete(usernameLower);
  }
}

io.use((socket, next) => {
  try {
    socket.auth = jwt.verify(
      socket.handshake.auth?.token,
      process.env.JWT_SECRET
    );
    next();
  } catch {
    next(new Error("AUTH_REQUIRED"));
  }
});

io.on("connection", async (socket) => {
  try {
    const user = await User.findById(socket.auth.userId).select("-password");
    if (!user || user.banned) return socket.disconnect(true);

    socket.userId = user._id.toString();
    socket.username = user.username;
    socket.usernameLower = user.usernameLower;
    socket.currentRoom = "General";

    socket.join("General");
    socket.join(`user:${socket.userId}`);

    addConnection(user, socket.id);
    io.emit("online users", onlineList());

    socket.emit("room history", await roomHistory("General"));
    socket.emit("dm conversations", await conversationList(socket.userId));

    socket.on("join room", async (name) => {
      try {
        const room = normalizeRoom(name);
        if (socket.currentRoom) socket.leave(socket.currentRoom);
        socket.join(room);
        socket.currentRoom = room;
        socket.emit("room history", await roomHistory(room));
      } catch (error) {
        console.error("Join room error:", error.message);
        socket.emit("chat error", "Could not load that room.");
      }
    });

    socket.on("chat message", async (payload) => {
      try {
        const fresh = await User.findById(socket.userId);
        if (!fresh || fresh.banned || fresh.muted) return;

        const message = String(payload?.message || "").trim().slice(0, 500);
        if (!message) return;

        const saved = await RoomMessage.create({
          room: socket.currentRoom,
          senderId: fresh._id,
          username: fresh.username,
          role: fresh.role,
          avatarDataUrl: fresh.avatarDataUrl,
          message
        });

        io.to(socket.currentRoom).emit("chat message", {
          id: saved._id.toString(),
          username: fresh.username,
          role: fresh.role,
          avatarDataUrl: fresh.avatarDataUrl,
          message,
          room: socket.currentRoom,
          time: formatTime(saved.createdAt),
          createdAt: saved.createdAt
        });
      } catch (error) {
        console.error("Room message error:", error.message);
        socket.emit("chat error", "Message could not be sent.");
      }
    });

    socket.on("typing", () => {
      socket.to(socket.currentRoom).emit("typing", socket.username);
    });

    socket.on("stop typing", () => {
      socket.to(socket.currentRoom).emit("stop typing", socket.username);
    });

    socket.on("load private history", async (username) => {
      try {
        const other = await User.findOne({
          usernameLower: String(username || "").trim().toLowerCase()
        }).select("_id username");

        if (!other || other._id.toString() === socket.userId) {
          return socket.emit("private history", {
            username: String(username || ""),
            messages: []
          });
        }

        const rows = await privateHistory(socket.userId, other._id);

        await PrivateMessage.updateMany(
          {
            senderId: other._id,
            receiverId: socket.userId,
            read: false
          },
          { $set: { read: true } }
        );

        socket.emit("private history", {
          username: other.username,
          messages: rows.map((row) => ({
            id: row._id.toString(),
            message: row.message,
            mine: row.senderId.toString() === socket.userId,
            read: row.read,
            time: formatTime(row.createdAt),
            createdAt: row.createdAt
          }))
        });
      } catch (error) {
        console.error("Private history error:", error.message);
        socket.emit("chat error", "Could not load that conversation.");
      }
    });

    socket.on("private message", async (payload) => {
      try {
        const fresh = await User.findById(socket.userId);
        if (!fresh || fresh.banned || fresh.muted) return;

        const targetName = String(payload?.to || "").trim().toLowerCase();
        const message = String(payload?.message || "").trim().slice(0, 500);
        if (!targetName || !message) return;

        const target = await User.findOne({ usernameLower: targetName }).select(
          "_id username banned"
        );

        if (!target || target.banned || target._id.toString() === socket.userId) {
          return socket.emit("chat error", "That user is unavailable.");
        }

        const saved = await PrivateMessage.create({
          senderId: fresh._id,
          receiverId: target._id,
          senderUsername: fresh.username,
          receiverUsername: target.username,
          message
        });

        const data = {
          id: saved._id.toString(),
          from: fresh.username,
          to: target.username,
          message,
          read: false,
          time: formatTime(saved.createdAt),
          createdAt: saved.createdAt
        };

        io.to(`user:${target._id}`).emit("private message", data);
        socket.emit("private message sent", data);

        io.to(`user:${target._id}`).emit(
          "dm conversations",
          await conversationList(target._id)
        );
        socket.emit("dm conversations", await conversationList(socket.userId));
      } catch (error) {
        console.error("Private message error:", error.message);
        socket.emit("chat error", "Private message could not be sent.");
      }
    });

    socket.on("announcement", async (text) => {
      const fresh = await User.findById(socket.userId);
      if (!fresh || fresh.role !== "OWNER") return;

      const message = String(text || "").trim().slice(0, 250);
      if (message) io.emit("announcement", { message });
    });

    socket.on("disconnect", () => {
      removeConnection(socket.usernameLower, socket.id);
      io.emit("online users", onlineList());
    });
  } catch (error) {
    console.error("Socket connection error:", error.message);
    socket.disconnect(true);
  }
});

const PORT = Number(process.env.PORT) || 3000;

connectDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🌊 TeenVerse running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });

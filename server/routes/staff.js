const express = require("express");
const User = require("../models/User");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

const roleManagers = ["OWNER", "CO_OWNER"];
const announcers = ["OWNER", "CO_OWNER", "SUPER_ADMIN"];
const banStaff = ["OWNER", "CO_OWNER", "SUPER_ADMIN", "ADMIN"];
const muteStaff = ["OWNER", "CO_OWNER", "SUPER_ADMIN", "ADMIN", "MODERATOR"];
const kickStaff = ["OWNER", "CO_OWNER", "SUPER_ADMIN", "ADMIN", "MODERATOR"];

const assignableRoles = [
  "CO_OWNER",
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "SUPER_VIP",
  "VIP",
  "USER"
];

router.post("/role", requireRoles(...roleManagers), async (req, res) => {
  const usernameLower = String(req.body.username || "").trim().toLowerCase();
  const role = String(req.body.role || "").toUpperCase();

  if (!assignableRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  const user = await User.findOne({ usernameLower });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.role === "OWNER") {
    return res.status(400).json({ message: "Owner role cannot be changed." });
  }

  user.role = role;
  await user.save();

  req.app.get("io")?.emit("role updated", {
    username: user.username,
    role
  });

  res.json({ message: `${user.username} is now ${role}.` });
});

router.post("/mute", requireRoles(...muteStaff), async (req, res) => {
  const usernameLower = String(req.body.username || "").trim().toLowerCase();
  const muted = Boolean(req.body.muted);

  const user = await User.findOne({ usernameLower });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.role === "OWNER") return res.status(400).json({ message: "Owner cannot be muted." });

  user.muted = muted;
  await user.save();

  req.app.get("io")?.emit("moderation updated", {
    username: user.username,
    action: muted ? "muted" : "unmuted"
  });

  res.json({ message: `${user.username} has been ${muted ? "muted" : "unmuted"}.` });
});

router.post("/ban", requireRoles(...banStaff), async (req, res) => {
  const usernameLower = String(req.body.username || "").trim().toLowerCase();
  const banned = Boolean(req.body.banned);

  const user = await User.findOne({ usernameLower });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.role === "OWNER") return res.status(400).json({ message: "Owner cannot be banned." });

  user.banned = banned;
  await user.save();

  const io = req.app.get("io");
  io?.emit("moderation updated", {
    username: user.username,
    action: banned ? "banned" : "unbanned"
  });

  if (banned) io?.to(`user:${user._id}`).emit("force logout", "Your account was banned.");

  res.json({ message: `${user.username} has been ${banned ? "banned" : "unbanned"}.` });
});

router.post("/kick", requireRoles(...kickStaff), async (req, res) => {
  const usernameLower = String(req.body.username || "").trim().toLowerCase();
  const user = await User.findOne({ usernameLower });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.role === "OWNER") return res.status(400).json({ message: "Owner cannot be kicked." });

  req.app.get("io")?.to(`user:${user._id}`).emit("force logout", "You were removed from the chat.");
  res.json({ message: `${user.username} was kicked.` });
});

router.post("/announcement", requireRoles(...announcers), async (req, res) => {
  const message = String(req.body.message || "").trim().slice(0, 250);
  if (!message) return res.status(400).json({ message: "Announcement cannot be empty." });

  req.app.get("io")?.emit("announcement", { message });
  res.json({ message: "Announcement sent." });
});

module.exports = router;

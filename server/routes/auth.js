const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and WebP images are allowed."));
    }
    cb(null, true);
  }
});

function publicUser(user) {
  return {
    username: user.username,
    age: user.age,
    gender: user.gender,
    country: user.country,
    role: user.role,
    bio: user.bio,
    mood: user.mood,
    relationship: user.relationship,
    avatarDataUrl: user.avatarDataUrl,
    createdAt: user.createdAt
  };
}

router.post("/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const age = Number(req.body.age);

    if (!username || !password || !Number.isInteger(age)) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }

    if (age < 13 || age > 20) {
      return res.status(400).json({ message: "Age must be between 13 and 20." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must have at least 6 characters." });
    }

    const usernameLower = username.toLowerCase();
    if (await User.findOne({ usernameLower })) {
      return res.status(409).json({ message: "That username is already taken." });
    }

    const role =
      usernameLower === String(process.env.OWNER_USERNAME || "ahya").toLowerCase()
        ? "OWNER"
        : "USER";

    const user = await User.create({
      username,
      usernameLower,
      password: await bcrypt.hash(password, 12),
      age,
      gender: String(req.body.gender || "Prefer not to say"),
      country: String(req.body.country || "Not set"),
      role
    });

    res.status(201).json({
      message: "Account created successfully.",
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const usernameLower = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ usernameLower });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    if (user.banned) {
      return res.status(403).json({ message: "This account is banned." });
    }

    const ownerName = String(process.env.OWNER_USERNAME || "ahya").toLowerCase();
    if (user.usernameLower === ownerName && user.role !== "OWNER") {
      user.role = "OWNER";
      await user.save();
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Could not log in." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.userId).select("-password");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(publicUser(user));
});

router.get("/profile/:username", requireAuth, async (req, res) => {
  const user = await User.findOne({
    usernameLower: String(req.params.username || "").toLowerCase()
  }).select("-password");

  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(publicUser(user));
});

router.put("/profile", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (typeof req.body.bio === "string") user.bio = req.body.bio.slice(0, 250);
    if (typeof req.body.mood === "string") user.mood = req.body.mood.slice(0, 80);
    if (typeof req.body.relationship === "string") {
      user.relationship = req.body.relationship.slice(0, 40);
    }
    if (typeof req.body.country === "string") user.country = req.body.country.slice(0, 60);

    if (req.file) {
      user.avatarDataUrl =
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    await user.save();

    req.app.get("io")?.emit("profile updated", publicUser(user));

    res.json({
      message: "Profile updated successfully.",
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Could not update profile." });
  }
});

module.exports = router;

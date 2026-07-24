const mongoose = require("mongoose");

const roles = [
  "OWNER",
  "CO_OWNER",
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "SUPER_VIP",
  "VIP",
  "USER"
];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    password: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      required: true,
      min: 13,
      max: 20
    },
    gender: {
      type: String,
      default: "Prefer not to say",
      maxlength: 30
    },
    country: {
      type: String,
      default: "Not set",
      maxlength: 60
    },
    role: {
    type: String,
    enum: [
        "Owner",
        "Co-Owner",
        "Super Admin",
        "Admin",
        "Moderator",
        "Super VIP",
        "VIP",
        "User"
    ],
    default: "User"
},
    bio: {
      type: String,
      default: "",
      maxlength: 250
    },
    mood: {
      type: String,
      default: "Available",
      maxlength: 80
    },
    relationship: {
      type: String,
      default: "Not set",
      maxlength: 40
    },
    avatarDataUrl: {
      type: String,
      default: ""
    },
    banned: {
      type: Boolean,
      default: false
    },
    muted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

userSchema.pre("validate", function normalize(next) {
  this.username = String(this.username || "").trim();
  this.usernameLower = this.username.toLowerCase();
  next();
});

module.exports = mongoose.model("User", userSchema);
module.exports.roles = roles;

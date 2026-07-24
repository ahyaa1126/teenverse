const mongoose = require("mongoose");

const roomMessageSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    role: {
      type: String,
      default: "USER"
    },
    avatarDataUrl: {
      type: String,
      default: ""
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400
    }
  },
  { versionKey: false }
);

roomMessageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("RoomMessage", roomMessageSchema);

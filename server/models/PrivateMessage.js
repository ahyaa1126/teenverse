const mongoose = require("mongoose");

const privateMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    senderUsername: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    receiverUsername: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true, versionKey: false }
);

privateMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
privateMessageSchema.index({ receiverId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("PrivateMessage", privateMessageSchema);

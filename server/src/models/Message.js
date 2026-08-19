const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    connectedAccountId: {
      type: String,
      required: true,
      index: true
    },
    chatId: {
      type: String,
      required: true,
      index: true
    },
    microsoftMessageId: {
      type: String,
      required: true,
      index: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderEmail: {
      type: String,
      default: ''
    },
    content: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      enum: ['text', 'html'],
      default: 'text'
    },
    isOutgoing: {
      type: Boolean,
      default: false
    },
    reactions: {
      type: Array,
      default: []
    },
    createdDateTime: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

MessageSchema.index({ chatId: 1, microsoftMessageId: 1 }, { unique: true });

module.exports = mongoose.model('Message', MessageSchema);

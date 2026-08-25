const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema(
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
    accountEmail: {
      type: String,
      default: '',
      index: true,
      lowercase: true,
      trim: true
    },
    microsoftChatId: {
      type: String,
      required: true,
      index: true
    },
    participant: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: 'Team Member'
    },
    company: {
      type: String,
      required: true
    },
    accountBadge: {
      type: String,
      default: 'Work Account'
    },
    avatar: {
      type: String,
      default: ''
    },
    lastMessagePreview: {
      type: String,
      default: ''
    },
    lastMessageTimestamp: {
      type: Date,
      default: Date.now
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    chatType: {
      type: String,
      enum: ['oneOnOne', 'group', 'meeting'],
      default: 'oneOnOne'
    },
    onlineStatus: {
      type: String,
      default: 'online'
    },
    pinned: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

ChatSchema.index({ userId: 1, connectedAccountId: 1, microsoftChatId: 1 }, { unique: true });

module.exports = mongoose.model('Chat', ChatSchema);

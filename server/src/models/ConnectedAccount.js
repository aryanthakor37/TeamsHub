const mongoose = require('mongoose');

const ConnectedAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    provider: {
      type: String,
      enum: ['microsoft'],
      default: 'microsoft'
    },
    accountId: {
      type: String,
      required: true,
      index: true
    },
    microsoftUserId: {
      type: String,
      default: '',
      index: true
    },
    displayName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    tenantId: {
      type: String,
      default: 'common'
    },
    accountType: {
      type: String,
      default: 'Microsoft Work Account'
    },
    status: {
      type: String,
      enum: ['connected', 'expired', 'disconnected'],
      default: 'connected'
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    scopes: [
      {
        type: String
      }
    ],
    // Token fields — NEVER selected by default, NEVER returned to client
    microsoftAccessToken: {
      type: String,
      default: '',
      select: false
    },
    microsoftRefreshToken: {
      type: String,
      default: '',
      select: false
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    lastAuthenticatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

ConnectedAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('ConnectedAccount', ConnectedAccountSchema);

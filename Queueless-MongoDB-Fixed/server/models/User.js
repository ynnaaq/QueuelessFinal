
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    // Email OTP verification
    emailVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationCodeHash: {
      type: String,
      default: null,
      select: false
    },

    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false
    },

    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false
    },

    emailVerificationLastSentAt: {
      type: Date,
      default: null,
      select: false
    },

    // Privacy consent
    privacyConsentAt: {
      type: Date,
      default: null
    },

    // Password reset
    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false
    },

    resetPasswordAttempts: {
      type: Number,
      default: 0,
      select: false
    },

    // Role-based access control
    role: {
      type: String,
      enum: ['student', 'staff', 'admin'],
      required: true
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended', 'Pending'],
      default: 'Active'
    },

    accountId: {
      type: String,
      default: '',
      trim: true
    },

    department: {
      type: String,
      default: '',
      trim: true
    },

    yearLevel: {
      type: String,
      default: '',
      trim: true
    },

    semester: {
      type: String,
      default: '',
      trim: true
    },

    avatar: {
      type: String,
      default: ''
    },

    office: {
      type: String,
      default: '',
      trim: true
    },

    schedule: [
      {
        day: {
          type: String,
          trim: true
        },

        start: {
          type: String,
          trim: true
        },

        end: {
          type: String,
          trim: true
        }
      }
    ]
  },
  {
    timestamps: true
  }
)

// Keep account IDs unique when provided
userSchema.index(
  { accountId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      accountId: {
        $type: 'string',
        $gt: ''
      }
    }
  }
)

export default mongoose.model('User', userSchema)

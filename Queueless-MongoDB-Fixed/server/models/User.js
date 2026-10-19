
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    // Supabase authentication reference
    supabaseUserId: {
  type: String,
  unique: true,
  sparse: true,
  default: undefined,
  trim: true
},
passwordHash: {
  type: String,
  required: true
},

    // Local email verification and password-recovery state. These fields are
    // intentionally excluded from ordinary queries and API responses.
    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationCodeHash: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    resetPasswordAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // User profile
    name: {
      type: String,
      required: true,
      trim: true
    },

    course: {
  type: String,
  default: '',
  trim: true
},

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // Privacy consent
    privacyConsentAt: {
      type: Date,
      default: null
    },

    // Role-based access control
    role: {
      type: String,
      enum: ['student', 'staff', 'admin'],
      required: true,
      default: 'student'
    },

    status: {
      type: String,
      enum: [
        'Active',
        'Inactive',
        'Suspended',
        'Pending'
      ],
      default: 'Active'
    },

    deletedAt: {
      type: Date,
      default: null
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Student information
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

    course: {
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

    // Profile picture
    avatar: {
      type: String,
      default: ''
    },

    // Staff assignment
    office: {
      type: String,
      default: '',
      trim: true
    },

    // Staff schedules
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

// Unique account IDs when provided
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

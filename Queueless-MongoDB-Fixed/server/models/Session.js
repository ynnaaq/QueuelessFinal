import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Stored explicitly so active sessions can be validated and MongoDB can
  // remove them automatically after they expire.
  expiresAt: {
    type: Date,
    required: true,
  },

  // The selected dashboard for accounts that have more than one role.
  activeRole: {
    type: String,
    enum: ['student', 'staff', 'admin'],
    default: null,
  },
}, {
  timestamps: true,
})

sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)

export default mongoose.model('Session', sessionSchema)

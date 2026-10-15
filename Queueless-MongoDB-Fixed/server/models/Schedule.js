
import mongoose from 'mongoose'

const shiftSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
  },
  { _id: true }
)

const scheduleSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    office: {
      type: String,
      required: true,
      trim: true,
    },

    shifts: {
      type: [shiftSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

// Each staff member can have only one schedule document
scheduleSchema.index(
  { staffId: 1 },
  { unique: true }
)

export default mongoose.model(
  'Schedule',
  scheduleSchema
)

import mongoose from 'mongoose'

const feedbackSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    unique: true,
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  officeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Office',
    required: true,
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },

  comment: {
    type: String,
    default: '',
    maxlength: 2000,
    trim: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
})

export default mongoose.model('Feedback', feedbackSchema)
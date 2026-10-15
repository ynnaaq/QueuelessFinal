import mongoose from 'mongoose'

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, trim: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  officeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Office', required: true, index: true },
  service: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['waiting', 'serving', 'skipped', 'served', 'cancelled'],
    default: 'waiting',
    index: true,
  },
  visitDate: { type: String, required: true, index: true },
  order: { type: Number, default: () => Date.now(), index: true },
  calledAt: Date,
  servedAt: Date,
  completedAt: Date,
}, { timestamps: true })

ticketSchema.index({ officeId: 1, visitDate: 1, status: 1, order: 1 })

export default mongoose.model('Ticket', ticketSchema)

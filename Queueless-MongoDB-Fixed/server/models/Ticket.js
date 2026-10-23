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

// These constraints are the final line of defence when two browser requests
// arrive at the API at the same time.  Application-level checks alone cannot
// prevent a read-then-write race.
ticketSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['waiting', 'serving', 'skipped'] } },
    name: 'one_active_ticket_per_student',
  }
)

ticketSchema.index(
  { officeId: 1, visitDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'serving' },
    name: 'one_serving_ticket_per_office_day',
  }
)

export default mongoose.model('Ticket', ticketSchema)

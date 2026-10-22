import mongoose from 'mongoose'

const promotionInvitationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  office: { type: String, required: true, trim: true },
  staffRole: { type: String, required: true, trim: true, default: 'Service staff' },
  schedule: [{ day: String, start: String, end: String }],
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true })

promotionInvitationSchema.index({ studentId: 1, status: 1 })

export default mongoose.model('PromotionInvitation', promotionInvitationSchema)

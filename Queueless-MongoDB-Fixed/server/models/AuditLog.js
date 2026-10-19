import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 160 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { timestamps: true }
)

auditLogSchema.index({ createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)

import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'staff', 'admin'], required: true },
  status: { type: String, enum: ['Active', 'Inactive', 'Suspended', 'Pending'], default: 'Active' },
  accountId: { type: String, default: '', trim: true },
  department: { type: String, default: '', trim: true },
  yearLevel: { type: String, default: '', trim: true },
  semester: { type: String, default: '', trim: true },
  office: { type: String, default: '', trim: true },
  schedule: [{
    day: { type: String, trim: true },
    start: { type: String, trim: true },
    end: { type: String, trim: true },
  }],
}, { timestamps: true })

userSchema.index({ accountId: 1 }, { unique: true, partialFilterExpression: { accountId: { $type: 'string', $gt: '' } } })

export default mongoose.model('User', userSchema)

import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  requirements: { type: [String], default: [] },
}, { _id: false })

const officeSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  open: { type: Boolean, default: true },
  wait: { type: Number, default: 4, min: 0 },
  sequence: { type: Number, default: 0, min: 0 },
  hours: { type: String, default: '8:00 AM - 5:00 PM' },
  description: { type: String, default: '', trim: true, maxlength: 240 },
  icon: { type: String, default: '', trim: true, maxlength: 40 },
  color: { type: String, default: '', trim: true, maxlength: 20 },
  services: { type: [serviceSchema], default: [] },
}, { timestamps: true })

export default mongoose.model('Office', officeSchema)

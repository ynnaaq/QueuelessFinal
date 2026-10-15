import 'dotenv/config'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import User from './models/User.js'
import Office from './models/Office.js'
import Ticket from './models/Ticket.js'
import Feedback from './models/Feedback.js'
import Session from './models/Session.js'

const hash = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
}

const definitions = [
  ['reg', 'Registrar', 'R', 4, ['Transcript / school records', 'Certificate request', 'Enrollment concern']],
  ['fin', 'Finance', 'F', 6, ['Tuition / school fees', 'Official receipt request', 'Account assessment']],
  ['csdl', 'CSDL', 'C', 5, ['Student clearance', 'ID concern', 'General student concern']],
]

await connectDB()

const library = await Office.findOne({ $or: [{ slug: 'lib' }, { name: 'Library' }] })
if (library) {
  const libraryStaff = await User.find({ role: 'staff', office: 'Library' }).select('_id')
  await Feedback.deleteMany({ officeId: library._id })
  await Ticket.deleteMany({ officeId: library._id })
  if (libraryStaff.length) {
    const staffIds = libraryStaff.map((member) => member._id)
    await Session.deleteMany({ userId: { $in: staffIds } })
    await User.deleteMany({ _id: { $in: staffIds } })
  }
  await Office.deleteOne({ _id: library._id })
}

for (const [slug, name, code, wait, services] of definitions) {
  await Office.updateOne(
    { slug },
    { $setOnInsert: {
      slug, name, code, wait, open: true, sequence: 0, hours: '8:00 AM - 5:00 PM',
      services: services.map(service => ({ name: service, requirements: ['Valid school ID', 'Relevant request form or supporting documents'] })),
    } },
    { upsert: true }
  )
}

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase()

  await User.updateOne(
    { email },
    {
      $set: {
        name: 'School Admin',
        email,
        passwordHash: hash(process.env.ADMIN_PASSWORD),
        role: 'admin',
        status: 'Active',
      },
    },
    { upsert: true }
  )

  console.log('Admin account synchronized.')
}

console.log('MongoDB seed complete.')
await mongoose.disconnect()

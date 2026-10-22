
import mongoose from 'mongoose'

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in server/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || 'queueless',
    serverSelectionTimeoutMS: 10000,
  })

  console.log(`MongoDB connected: ${mongoose.connection.name} (${mongoose.connection.host})`)
}

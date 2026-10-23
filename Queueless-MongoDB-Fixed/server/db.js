
import mongoose from 'mongoose'

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in server/.env')
  }

  mongoose.connection.on('error', error => {
    console.error('MongoDB connection error:', error.message)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. New API requests will return 503 until it reconnects.')
  })

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'queueless',
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    })
  } catch (error) {
    // Do not include the URI: it may contain credentials.
    throw new Error(`MongoDB connection failed: ${error.message}`)
  }

  console.log(`MongoDB connected: ${mongoose.connection.name} (${mongoose.connection.host})`)
}

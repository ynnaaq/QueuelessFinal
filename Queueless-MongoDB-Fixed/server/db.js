
import mongoose from 'mongoose'

export async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing in server/.env')
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'queueless',
      serverSelectionTimeoutMS: 10000
    })

    console.log('=================================')
    console.log('MongoDB connected successfully')
    console.log('Database:', mongoose.connection.name)
    console.log('Host:', mongoose.connection.host)
    console.log('=================================')

  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

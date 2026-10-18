import mongoose from 'mongoose'

export async function connectDB() {
  try {
  await mongoose.connect(process.env.MONGODB_URI, {
  dbName: 'queueless'
})    
    console.log('Database:', mongoose.connection.name)
    console.log('Host:', mongoose.connection.host)

    console.log(
      'MongoDB connected successfully'
    )

    console.log(
      'Database:',
      mongoose.connection.name
    )

    console.log(
      'Host:',
      mongoose.connection.host
    )
  } catch (error) {
    console.error(
      'MongoDB connection failed:',
      error.message
    )

    process.exit(1)
  }
}
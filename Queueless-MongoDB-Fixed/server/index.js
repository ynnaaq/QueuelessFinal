import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import { createApp } from './app.js'
import dotenv from 'dotenv'

dotenv.config({
  path: 'server/.env'
})

// Connect to MongoDB Atlas
await connectDB()

// Initialize Express application
const { app, initialize } = createApp({
  seedDemo: process.env.SEED_DEMO === 'true',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
})

await initialize()

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'

const server = app.listen(PORT, HOST, () => {
  console.log(`Queueless API listening on ${HOST}:${PORT}`)
})

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await mongoose.disconnect()
      process.exit(0)
    })
  })
}

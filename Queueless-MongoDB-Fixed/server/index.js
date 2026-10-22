
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import { createApp } from './app.js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Resolve from this file rather than the terminal's working directory so the
// API always loads server/.env whether it is started from the project root or
// from the server directory.
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(serverDirectory, '.env') })
// Root .env remains a local-development fallback for the Vite variables.
dotenv.config()

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

console.log(
  'Supabase configuration loaded:',
  Boolean(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
    (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  )
)

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await mongoose.disconnect()
      process.exit(0)
    })
  })
}

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import { createApp } from './app.js'

await connectDB()

const { app, initialize } = createApp({
  seedDemo: process.env.SEED_DEMO === 'true',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
})

await initialize()

const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '127.0.0.1'

const server = app.listen(port, host, () => {
  console.log(`Queueless API: http://localhost:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await mongoose.disconnect()
      process.exit(0)
    })
  })
}

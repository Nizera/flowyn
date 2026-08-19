import express from 'express'
import cors from 'cors'
import { config } from './config'
import { connectDB } from './lib/database'
import { createChildLogger } from './lib/logger'
import sessionsRouter from './server/routes/sessions'
import messagesRouter from './server/routes/messages'

const log = createChildLogger('server')

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use(sessionsRouter)
app.use(messagesRouter)

app.get('/health', async (req, res) => {
  try {
    const { getSupabase } = await import('./lib/database')
    const supabase = getSupabase()
    const { error } = await supabase.from('wa_sessions').select('id').limit(1)
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' })
  }
})

async function start() {
  await connectDB()

  app.listen(config.port, '0.0.0.0', () => {
    log.info({ port: config.port }, 'WA Worker started')
    log.info({ maxSessions: config.worker.maxSessionsPerWorker }, 'Worker config loaded')
  })
}

start().catch((err) => {
  log.error(err, 'Failed to start server')
  process.exit(1)
})

process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('unhandledRejection', (err) => {
  log.error(err, 'Unhandled rejection')
})

process.on('uncaughtException', (err) => {
  log.error(err, 'Uncaught exception')
  process.exit(1)
})

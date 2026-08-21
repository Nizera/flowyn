import { Router, Request, Response } from 'express'
import { config } from '../../config'
import { createSession, disconnectSession, getStatus, getQRCode, getSessionCount, getSessionId } from '../../baileys/session-manager'
import { createChildLogger } from '../../lib/logger'

const log = createChildLogger('routes:sessions')
const router = Router()

function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token !== config.worker.secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    sessions: getSessionCount(),
    maxSessions: config.worker.maxSessionsPerWorker,
    uptime: process.uptime(),
  })
})

// Match what Next.js app calls: /api/sessions/:id/pair
// :id = wa_sessions.id (UUID da sessão criada no app)
router.post('/api/sessions/:id/pair', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.params.id as string
  try {
    const result = await createSession(sessionId)
    res.json(result)
  } catch (err: any) {
    log.error(err, 'Failed to create session')
    res.status(500).json({ error: err.message })
  }
})

// Match what Next.js app calls: /api/sessions/:id/logout
router.post('/api/sessions/:id/logout', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.params.id as string
  try {
    await disconnectSession(sessionId)
    res.json({ status: 'disconnected' })
  } catch (err: any) {
    log.error(err, 'Failed to disconnect session')
    res.status(500).json({ error: err.message })
  }
})

// Match what Next.js app calls: /api/sessions/:id/status
router.get('/api/sessions/:id/status', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.params.id as string
  const status = getStatus(sessionId)
  res.json(status)
})

// Match what Next.js app calls: /api/sessions/:id/qr
router.get('/api/sessions/:id/qr', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.params.id as string
  const qr = getQRCode(sessionId)
  if (!qr) {
    return res.json({ qr: null, message: 'No QR code available. Session may already be connected.' })
  }
  res.json({ qr })
})

// Legacy routes (backward compat)
router.get('/sessions/:userId/status', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.params.userId as string
  const status = getStatus(userId)
  res.json(status)
})

router.get('/sessions/:userId/qr', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.params.userId as string
  const qr = getQRCode(userId)
  if (!qr) {
    return res.json({ qr: null, message: 'No QR code available. Session may already be connected.' })
  }
  res.json({ qr })
})

router.post('/sessions', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.body
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const result = await createSession(userId)
    res.json(result)
  } catch (err: any) {
    log.error(err, 'Failed to create session')
    res.status(500).json({ error: err.message })
  }
})

router.delete('/sessions/:userId', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.params.userId as string
  try {
    await disconnectSession(userId)
    res.json({ status: 'disconnected' })
  } catch (err: any) {
    log.error(err, 'Failed to disconnect session')
    res.status(500).json({ error: err.message })
  }
})

export default router

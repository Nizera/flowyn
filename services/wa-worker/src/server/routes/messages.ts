import { Router, Request, Response } from 'express'
import { config } from '../../config'
import { sendMessage, getStatus } from '../../baileys/session-manager'
import { createChildLogger } from '../../lib/logger'

const log = createChildLogger('routes:messages')
const router = Router()

function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token !== config.worker.secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// Match what Next.js app calls: POST /api/messages/send
router.post('/api/messages/send', authMiddleware, async (req: Request, res: Response) => {
  const { sessionId, userId, to, text, phone, content, media, type = 'text', mediaUrl, metadata } = req.body

  const targetUserId = sessionId || userId
  const targetPhone = to || phone
  const targetContent = text || content

  if (!targetUserId || !targetPhone || !targetContent) {
    return res.status(400).json({ error: 'userId/sessionId, to/phone, and text/content are required' })
  }

  const status = getStatus(targetUserId)
  if (status.status !== 'connected') {
    return res.status(400).json({ error: 'Session not connected', sessionStatus: status.status })
  }

  try {
    const result = await sendMessage(targetUserId, targetPhone, targetContent, type, media || mediaUrl, metadata)
    res.json(result)
  } catch (err: any) {
    log.error(err, 'Failed to send message')
    res.status(500).json({ error: err.message })
  }
})

// Match what Next.js app calls: POST /api/messages/bulk
router.post('/api/messages/bulk', authMiddleware, async (req: Request, res: Response) => {
  const { sessionId, userId, contacts, recipients } = req.body

  const targetUserId = sessionId || userId
  const targetRecipients = contacts || recipients

  if (!targetUserId || !targetRecipients?.length) {
    return res.status(400).json({ error: 'userId/sessionId and contacts/recipients are required' })
  }

  const status = getStatus(targetUserId)
  if (status.status !== 'connected') {
    return res.status(400).json({ error: 'Session not connected' })
  }

  const results = []
  for (const recipient of targetRecipients) {
    const phone = typeof recipient === 'string' ? recipient : recipient.phone
    const content = typeof recipient === 'string' ? req.body.text : recipient.content
    const recipientType = typeof recipient === 'string' ? 'text' : (recipient.type || 'text')
    const media = typeof recipient === 'string' ? undefined : recipient.mediaUrl

    try {
      const result = await sendMessage(targetUserId, phone, content, recipientType, media)
      results.push({ phone, ...result })
    } catch (err: any) {
      results.push({ phone, success: false, error: err.message })
    }
  }

  res.json({ results, total: targetRecipients.length })
})

// Legacy routes (backward compat)
router.post('/send-message', authMiddleware, async (req: Request, res: Response) => {
  const { userId, phone, content, type = 'text', mediaUrl, metadata } = req.body

  if (!userId || !phone || !content) {
    return res.status(400).json({ error: 'userId, phone, and content are required' })
  }

  const status = getStatus(userId)
  if (status.status !== 'connected') {
    return res.status(400).json({ error: 'Session not connected', sessionStatus: status.status })
  }

  try {
    const result = await sendMessage(userId, phone, content, type, mediaUrl, metadata)
    res.json(result)
  } catch (err: any) {
    log.error(err, 'Failed to send message')
    res.status(500).json({ error: err.message })
  }
})

router.post('/send-bulk', authMiddleware, async (req: Request, res: Response) => {
  const { userId, recipients } = req.body

  if (!userId || !recipients?.length) {
    return res.status(400).json({ error: 'userId and recipients are required' })
  }

  const status = getStatus(userId)
  if (status.status !== 'connected') {
    return res.status(400).json({ error: 'Session not connected' })
  }

  const results = []
  for (const recipient of recipients) {
    try {
      const result = await sendMessage(
        userId,
        recipient.phone,
        recipient.content,
        recipient.type || 'text',
        recipient.mediaUrl,
        recipient.metadata
      )
      results.push({ phone: recipient.phone, ...result })
    } catch (err: any) {
      results.push({ phone: recipient.phone, success: false, error: err.message })
    }
  }

  res.json({ results, total: recipients.length })
})

export default router

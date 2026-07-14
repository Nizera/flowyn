import { NextRequest, NextResponse } from 'next/server'
import { evaluateAllRules } from '@/lib/auto-rules'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[AutoRules Cron] Starting evaluation...')

  const result = await evaluateAllRules()

  console.log(`[AutoRules Cron] Evaluated ${result.rulesEvaluated} rules, triggered ${result.actionsTriggered} actions`)
  if (result.errors.length > 0) {
    console.error('[AutoRules Cron] Errors:', result.errors)
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    rules_evaluated: result.rulesEvaluated,
    actions_triggered: result.actionsTriggered,
    errors: result.errors.length > 0 ? result.errors : undefined,
    results: result.results,
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Auto-rules cron endpoint is running. Use POST to trigger evaluation.',
  })
}

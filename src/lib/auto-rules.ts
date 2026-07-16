import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { GRAPH_API } from '@/lib/meta-graph-api'

export type RuleMetric = 'roas' | 'spend' | 'cpa' | 'ctr' | 'cpc' | 'conversions' | 'purchase_value' | 'impressions' | 'cpm'
export type RuleOperator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
export type RuleAction = 'pause' | 'resume' | 'increase_budget' | 'decrease_budget' | 'notify'
export type RuleEntityLevel = 'campaign' | 'adset' | 'ad'

export interface AutomationRule {
  id: string
  user_id: string
  ad_account_id: string
  name: string
  enabled: boolean
  entity_level: RuleEntityLevel
  entity_ids: string[]
  condition_metric: RuleMetric
  condition_operator: RuleOperator
  condition_value: number
  condition_period: number
  action_type: RuleAction
  action_value: number | null
  action_value_type: 'percentage' | 'absolute'
  last_triggered_at: string | null
  trigger_count: number
  cooldown_hours: number
  notify_whatsapp: boolean
  notify_email: boolean
  webhook_url: string | null
  webhook_secret: string | null
}

interface Insights {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversion_value: number
  purchase_value: number
  purchase_count: number
  cpc: number
  cpm: number
  ctr: number
}

function computeMetric(insights: Insights, metric: RuleMetric): number {
  switch (metric) {
    case 'roas':
      return insights.spend > 0 ? insights.purchase_value / insights.spend : 0
    case 'spend':
      return insights.spend
    case 'cpa':
      return insights.conversions > 0 ? insights.spend / insights.conversions : 0
    case 'ctr':
      return insights.ctr
    case 'cpc':
      return insights.cpc
    case 'conversions':
      return insights.conversions
    case 'purchase_value':
      return insights.purchase_value
    case 'impressions':
      return insights.impressions
    case 'cpm':
      return insights.cpm
    default:
      return 0
  }
}

function evaluateCondition(value: number, operator: RuleOperator, threshold: number): boolean {
  switch (operator) {
    case 'lt': return value < threshold
    case 'lte': return value <= threshold
    case 'gt': return value > threshold
    case 'gte': return value >= threshold
    case 'eq': return Math.abs(value - threshold) < 0.001
    default: return false
  }
}

function isCooldownActive(rule: AutomationRule): boolean {
  if (!rule.last_triggered_at) return false
  const lastTriggered = new Date(rule.last_triggered_at).getTime()
  const cooldownMs = rule.cooldown_hours * 60 * 60 * 1000
  return Date.now() - lastTriggered < cooldownMs
}

function getOperatorLabel(op: RuleOperator): string {
  switch (op) {
    case 'lt': return 'menor que'
    case 'lte': return 'menor ou igual a'
    case 'gt': return 'maior que'
    case 'gte': return 'maior ou igual a'
    case 'eq': return 'igual a'
    default: return op
  }
}

function getMetricLabel(metric: RuleMetric): string {
  const labels: Record<RuleMetric, string> = {
    roas: 'ROAS',
    spend: 'Gasto',
    cpa: 'CPA',
    ctr: 'CTR',
    cpc: 'CPC',
    conversions: 'Conversoes',
    purchase_value: 'Valor de Vendas',
    impressions: 'Impressoes',
    cpm: 'CPM',
  }
  return labels[metric] || metric
}

function getActionLabel(action: RuleAction): string {
  switch (action) {
    case 'pause': return 'Pausar'
    case 'resume': return 'Retomar'
    case 'increase_budget': return 'Aumentar orcamento'
    case 'decrease_budget': return 'Diminuir orcamento'
    case 'notify': return 'Notificar'
    default: return action
  }
}

export async function fetchEntityInsights(
  supabase: SupabaseClient,
  adAccountId: string,
  entityLevel: RuleEntityLevel,
  entityId: string,
  periodHours: number
): Promise<Insights> {
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000)
  const until = new Date()

  let idField: string
  switch (entityLevel) {
    case 'campaign': idField = 'campaign_id'; break
    case 'adset': idField = 'ad_set_id'; break
    case 'ad': idField = 'ad_id'; break
    default: return { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, purchase_value: 0, purchase_count: 0, cpc: 0, cpm: 0, ctr: 0 }
  }

  const { data: rows } = await supabase
    .from('ad_insights_cache')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq(idField, entityId)
    .eq('insight_level', entityLevel === 'campaign' ? 'campaign' : entityLevel === 'adset' ? 'adset' : 'ad')
    .gte('date', since.toISOString().slice(0, 10))
    .lte('date', until.toISOString().slice(0, 10))

  if (!rows || rows.length === 0) {
    return { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, purchase_value: 0, purchase_count: 0, cpc: 0, cpm: 0, ctr: 0 }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + (Number(r.spend) || 0),
      impressions: acc.impressions + (Number(r.impressions) || 0),
      clicks: acc.clicks + (Number(r.clicks) || 0),
      conversions: acc.conversions + (Number(r.conversions) || 0),
      conversion_value: acc.conversion_value + (Number(r.conversion_value) || 0),
      purchase_value: acc.purchase_value + (Number(r.purchase_value) || 0),
      purchase_count: acc.purchase_count + (Number(r.purchase_count) || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, purchase_value: 0, purchase_count: 0 }
  )

  return {
    ...totals,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
  }
}

interface MetaCampaignData {
  daily_budget?: string
  lifetime_budget?: string
  error?: { message: string }
}

async function executeMetaAction(
  accessToken: string,
  entityId: string,
  action: RuleAction,
  actionValue: number | null,
  actionValueType: string
): Promise<{ success: boolean; error?: string; newStatus?: string }> {
  if (action === 'notify') {
    return { success: true }
  }

  if (action === 'pause' || action === 'resume') {
    const newStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE'
    const res = await fetch(`${GRAPH_API}/${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, access_token: accessToken }),
    })
    const data = await res.json()
    if (data.error) {
      return { success: false, error: data.error.message }
    }
    return { success: true, newStatus }
  }

  if (action === 'increase_budget' || action === 'decrease_budget') {
    const currentDataRes = await fetch(`${GRAPH_API}/${entityId}?fields=daily_budget,lifetime_budget&access_token=${accessToken}`)
    const currentDataJson = await currentDataRes.json()
    const currentData: MetaCampaignData = currentDataJson.data || currentDataJson
    if (currentData?.error) {
      return { success: false, error: currentData.error.message }
    }

    const currentBudget = Number(currentData?.daily_budget || currentData?.lifetime_budget || 0)
    if (currentBudget === 0) {
      return { success: false, error: 'No budget found to modify' }
    }

    let newBudget: number
    if (actionValueType === 'percentage') {
      const multiplier = action === 'increase_budget' ? 1 + (actionValue || 0) / 100 : 1 - (actionValue || 0) / 100
      newBudget = Math.round(currentBudget * multiplier)
    } else {
      newBudget = action === 'increase_budget' ? currentBudget + (actionValue || 0) : currentBudget - (actionValue || 0)
    }

    newBudget = Math.max(100, newBudget)

    const budgetField = currentData?.daily_budget ? 'daily_budget' : 'lifetime_budget'
    const res = await fetch(`${GRAPH_API}/${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [budgetField]: String(newBudget), access_token: accessToken }),
    })
    const data = await res.json()
    if (data.error) {
      return { success: false, error: data.error.message }
    }
    return { success: true }
  }

  return { success: false, error: 'Unknown action type' }
}

async function updateLocalStatus(
  supabase: SupabaseClient,
  entityLevel: RuleEntityLevel,
  entityId: string,
  adAccountId: string,
  userId: string,
  newStatus: string
) {
  let table: string
  let idField: string
  switch (entityLevel) {
    case 'campaign': table = 'campaigns'; idField = 'campaign_id'; break
    case 'adset': table = 'ad_sets'; idField = 'ad_set_id'; break
    case 'ad': table = 'ads'; idField = 'ad_id'; break
    default: return
  }
  await supabase
    .from(table)
    .update({ status: newStatus, effective_status: newStatus, updated_at: new Date().toISOString() })
    .eq(idField, entityId)
    .eq('ad_account_id', adAccountId)
    .eq('user_id', userId)
}

async function getEntityName(supabase: SupabaseClient, entityLevel: RuleEntityLevel, entityId: string, adAccountId: string): Promise<string> {
  let table: string
  let idField: string
  switch (entityLevel) {
    case 'campaign': table = 'campaigns'; idField = 'campaign_id'; break
    case 'adset': table = 'ad_sets'; idField = 'ad_set_id'; break
    case 'ad': table = 'ads'; idField = 'ad_id'; break
    default: return entityId
  }
  const { data } = await supabase
    .from(table)
    .select('name')
    .eq(idField, entityId)
    .eq('ad_account_id', adAccountId)
    .maybeSingle()
  return data?.name || entityId
}

export async function sendWebhook(
  webhookUrl: string,
  webhookSecret: string | null,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (webhookSecret) {
      const signature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
      headers['X-Flowyn-Signature'] = `hmac-sha256=${signature}`
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    })

    return res.ok
  } catch (error) {
    console.error('[AutoRules] Webhook failed:', error)
    return false
  }
}

export async function sendRuleEmail(
  rule: AutomationRule,
  entityName: string,
  actualValue: number
): Promise<boolean> {
  const { getResendClient } = await import('@/lib/resend')
  const resend = getResendClient()
  if (!resend) return false

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', rule.user_id)
    .maybeSingle()

  const recipientEmail = profile?.email
  if (!recipientEmail) return false

  const subject = `[FlowynPay] Regra "${rule.name}" disparou`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1e293b;">Regra Automatizada Disparou</h2>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Regra:</strong> ${rule.name}</p>
        <p style="margin:4px 0;"><strong>Entidade:</strong> ${entityName} (${rule.entity_level})</p>
        <p style="margin:4px 0;"><strong>Condicao:</strong> ${getMetricLabel(rule.condition_metric)} ${getOperatorLabel(rule.condition_operator)} ${rule.condition_value}</p>
        <p style="margin:4px 0;"><strong>Valor atual:</strong> ${actualValue.toFixed(2)}</p>
        <p style="margin:4px 0;"><strong>Acao tomada:</strong> ${getActionLabel(rule.action_type)}</p>
      </div>
      <p style="color:#64748b;font-size:12px;">Automacao FlowynPay - Nao responda este email</p>
    </div>
  `
  try {
    await resend.emails.send({
      from: 'Flowyn <noreply@flowyn.com.br>',
      to: recipientEmail,
      subject,
      html,
    })
    return true
  } catch (error) {
    console.error('[AutoRules] Email failed:', error)
    return false
  }
}

export interface EvaluateResult {
  ruleId: string
  ruleName: string
  entityId: string
  entityName: string
  conditionMet: boolean
  metric: RuleMetric
  actualValue: number
  threshold: number
  action: RuleAction
  actionResult: 'success' | 'error' | 'skipped_cooldown' | 'skipped_not_met'
  actionError?: string
}

export async function evaluateRule(
  supabase: SupabaseClient,
  rule: AutomationRule
): Promise<EvaluateResult[]> {
  const results: EvaluateResult[] = []

  if (!rule.enabled) return results
  if (isCooldownActive(rule)) return results

  const entities = rule.entity_ids.length > 0
    ? rule.entity_ids
    : await getAllEntityIds(supabase, rule.entity_level, rule.ad_account_id, rule.user_id)

  for (const entityId of entities) {
    const insights = await fetchEntityInsights(supabase, rule.ad_account_id, rule.entity_level, entityId, rule.condition_period)
    const actualValue = computeMetric(insights, rule.condition_metric)
    const conditionMet = evaluateCondition(actualValue, rule.condition_operator, rule.condition_value)

    const entityName = await getEntityName(supabase, rule.entity_level, entityId, rule.ad_account_id)

    if (!conditionMet) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        entityId,
        entityName,
        conditionMet: false,
        metric: rule.condition_metric,
        actualValue,
        threshold: rule.condition_value,
        action: rule.action_type,
        actionResult: 'skipped_not_met',
      })
      continue
    }

    if (isCooldownActive(rule)) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        entityId,
        entityName,
        conditionMet: true,
        metric: rule.condition_metric,
        actualValue,
        threshold: rule.condition_value,
        action: rule.action_type,
        actionResult: 'skipped_cooldown',
      })
      continue
    }

    const accessToken = await getDecryptedToken(rule.ad_account_id, rule.user_id)
    if (!accessToken) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        entityId,
        entityName,
        conditionMet: true,
        metric: rule.condition_metric,
        actualValue,
        threshold: rule.condition_value,
        action: rule.action_type,
        actionResult: 'error',
        actionError: 'Token not found',
      })
      continue
    }

    const metaResult = await executeMetaAction(accessToken, entityId, rule.action_type, rule.action_value, rule.action_value_type)

    if (metaResult.success && metaResult.newStatus) {
      await updateLocalStatus(supabase, rule.entity_level, entityId, rule.ad_account_id, rule.user_id, metaResult.newStatus)
    }

    if (metaResult.success) {
      await supabase
        .from('automation_rules')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: rule.trigger_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id)
    }

    const conditionMetPayload = {
      metric: rule.condition_metric,
      operator: rule.condition_operator,
      threshold: rule.condition_value,
      actual_value: actualValue,
      period_hours: rule.condition_period,
    }

    await supabase.from('automation_rules_log').insert({
      rule_id: rule.id,
      user_id: rule.user_id,
      ad_account_id: rule.ad_account_id,
      entity_level: rule.entity_level,
      entity_id: entityId,
      entity_name: entityName,
      condition_met: conditionMetPayload,
      action_taken: rule.action_type,
      action_result: metaResult.success ? 'success' : 'error',
      action_error: metaResult.error || null,
    })

    if (rule.webhook_url) {
      await sendWebhook(rule.webhook_url, rule.webhook_secret, {
        event: 'automation_rule_triggered',
        rule: {
          id: rule.id,
          name: rule.name,
          action: rule.action_type,
          entity_level: rule.entity_level,
          entity_name: entityName,
          entity_id: entityId,
          ad_account_id: rule.ad_account_id,
        },
        condition: conditionMetPayload,
        execution: {
          timestamp: new Date().toISOString(),
          trigger_count: rule.trigger_count + 1,
          meta_action: metaResult.newStatus || rule.action_type,
        },
      })
    }

    if (rule.notify_email) {
      await sendRuleEmail(rule, entityName, actualValue)
    }

    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      entityId,
      entityName,
      conditionMet: true,
      metric: rule.condition_metric,
      actualValue,
      threshold: rule.condition_value,
      action: rule.action_type,
      actionResult: metaResult.success ? 'success' : 'error',
      actionError: metaResult.error,
    })

    await new Promise(r => setTimeout(r, 200))
  }

  return results
}

async function getAllEntityIds(
  supabase: SupabaseClient,
  entityLevel: RuleEntityLevel,
  adAccountId: string,
  userId: string
): Promise<string[]> {
  let table: string
  let idField: string
  switch (entityLevel) {
    case 'campaign': table = 'campaigns'; idField = 'campaign_id'; break
    case 'adset': table = 'ad_sets'; idField = 'ad_set_id'; break
    case 'ad': table = 'ads'; idField = 'ad_id'; break
    default: return []
  }
  const { data } = await supabase
    .from(table)
    .select(idField)
    .eq('ad_account_id', adAccountId)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((r: any) => r[idField])
}

export async function evaluateAllRules(): Promise<{
  rulesEvaluated: number
  actionsTriggered: number
  errors: string[]
  results: EvaluateResult[]
}> {
  const supabase = createAdminClient()
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('enabled', true)

  if (error || !rules) {
    return { rulesEvaluated: 0, actionsTriggered: 0, errors: [error?.message || 'Failed to fetch rules'], results: [] }
  }

  const allResults: EvaluateResult[] = []
  const errors: string[] = []
  let actionsTriggered = 0

  for (const rule of rules) {
    try {
      const results = await evaluateRule(supabase, rule as AutomationRule)
      allResults.push(...results)
      actionsTriggered += results.filter(r => r.actionResult === 'success').length
    } catch (err: unknown) {
      errors.push(`Rule ${rule.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return {
    rulesEvaluated: rules.length,
    actionsTriggered,
    errors,
    results: allResults,
  }
}

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createChildLogger } from './logger'
import { config } from '../config'

const log = createChildLogger('database')

let supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    })
  }
  return supabase
}

export async function connectDB() {
  try {
    const client = getSupabase()
    const { error } = await client.from('wa_sessions').select('id').limit(1)
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    log.info('Database connected')
  } catch (err) {
    log.error(err, 'Failed to connect to database')
    process.exit(1)
  }
}

// Compatibility helpers to match Prisma-like API used in session-manager

export const db = {
  waSession: {
    async update({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) {
      const client = getSupabase()
      const { error } = await client
        .from('wa_sessions')
        .update(data)
        .eq('user_id', where.userId)
      if (error) throw error
    },

    async upsert({ where, create, update }: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) {
      const client = getSupabase()
      const { data: existing } = await client
        .from('wa_sessions')
        .select('id')
        .eq('user_id', where.userId)
        .maybeSingle()

      if (existing) {
        const { error } = await client
          .from('wa_sessions')
          .update(update)
          .eq('user_id', where.userId)
        if (error) throw error
      } else {
        const { error } = await client
          .from('wa_sessions')
          .insert({ ...create, user_id: where.userId })
        if (error) throw error
      }
    },

    async findUnique({ where }: { where: { userId: string } }) {
      const client = getSupabase()
      const { data, error } = await client
        .from('wa_sessions')
        .select('*')
        .eq('user_id', where.userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  },
}

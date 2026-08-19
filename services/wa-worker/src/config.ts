import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  flowyn: {
    url: process.env.FLOWYN_URL || 'http://localhost:3000',
  },

  worker: {
    secret: process.env.WORKER_SECRET || '',
    maxSessionsPerWorker: parseInt(process.env.MAX_SESSIONS_PER_WORKER || '25'),
    sessionRestartHours: parseInt(process.env.SESSION_RESTART_HOURS || '4'),
    messageDelayMinMs: parseInt(process.env.MESSAGE_DELAY_MIN_MS || '2000'),
    messageDelayMaxMs: parseInt(process.env.MESSAGE_DELAY_MAX_MS || '5000'),
  },
} as const

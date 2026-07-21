const REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYMENT_ENCRYPTION_KEY',
  'ASAAS_API_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
] as const

const OPTIONAL_VARS = [
  'META_CAPI_ACCESS_TOKEN',
  'META_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
  // CORREÇÃO W6 (auditoria tracking): env-validation checava 'GOOGLE_ADS_PIXEL_ID'
  // mas o código usa 'NEXT_PUBLIC_GOOGLE_ADS_PIXEL_ID' (GlobalPixels.tsx). Lista
  // alinhada com os nomes reais consumidos pelo app.
  'NEXT_PUBLIC_GOOGLE_ADS_PIXEL_ID',
  'NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL',
  'META_CAPI_PIXEL_ID',
  'META_APP_ID',
  'SUPABASE_ACCESS_TOKEN',
] as const

let validated = false

export function validateEnv() {
  if (validated) return
  validated = true

  const missing: string[] = []
  const warnings: string[] = []

  for (const key of REQUIRED_SERVER_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  for (const key of OPTIONAL_VARS) {
    if (!process.env[key]) {
      warnings.push(key)
    }
  }

  if (warnings.length > 0) {
    console.warn(`[Env] Optional vars not set: ${warnings.join(', ')}`)
  }

  if (missing.length > 0) {
    console.error(`[Env] FATAL: Missing required env vars: ${missing.join(', ')}`)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  const encKey = process.env.PAYMENT_ENCRYPTION_KEY
  if (encKey && encKey.length !== 64) {
    throw new Error('PAYMENT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }

  console.log('[Env] All required environment variables validated')
}

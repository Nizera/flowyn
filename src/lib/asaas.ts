const ASAAS_API_KEY = process.env.ASAAS_API_KEY
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3'

if (!ASAAS_API_KEY) {
  console.warn('[Asaas] ATENÇÃO: ASAAS_API_KEY não encontrada no process.env')
}

export async function asaasRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${ASAAS_API_URL}${endpoint}`
  
  // Debug length (without exposing the key)
  console.log(`[Asaas] Request: ${options.method || 'GET'} ${endpoint}`)
  console.log(`[Asaas] API Key length: ${ASAAS_API_KEY?.length || 0}`)

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY || '',
      'access-token': ASAAS_API_KEY || '', // Some versions use hyphen
      ...options.headers,
    },
  })

  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch (e) {
    data = { error: text }
  }

  if (!response.ok) {
    console.error(`[Asaas API Error] ${endpoint}:`, data)
    throw new Error(data.errors?.[0]?.description || data.error || 'Erro na requisição Asaas')
  }

  return data
}

/**
 * Split payment calculation
 */
export function calculateAsaasSplit(amount: number, commissionRate: number) {
  const platformFeePercent = 10 // Fixed 10%
  
  const platformFee = Math.round(amount * (platformFeePercent / 100) * 100) / 100
  const affiliateCommission = Math.round(amount * (commissionRate / 100) * 100) / 100
  
  // Asaas uses fixed values or percentages for splits.
  // We'll use fixed values to be precise.
  
  return {
    platformFee,
    affiliateCommission,
  }
}

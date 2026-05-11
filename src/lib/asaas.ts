// ============================================================
// ASAAS API LIBRARY
// The key is stored WITHOUT the leading '$' in .env to avoid
// Next.js variable interpolation. We prepend it here.
// On Vercel, store ASAAS_API_KEY with the full key (including $).
// ============================================================

const RAW_KEY = process.env.ASAAS_API_KEY || ''

// If the key already starts with $, use as-is (Vercel production).
// If not (local dev, stored without $), prepend it.
const ASAAS_API_KEY = RAW_KEY.startsWith('$') ? RAW_KEY : `$${RAW_KEY}`

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3'

if (!RAW_KEY) {
  console.error('[Asaas] CRÍTICO: ASAAS_API_KEY não configurada!')
} else {
  console.log(`[Asaas] Key carregada. Inicia com: ${ASAAS_API_KEY.substring(0, 6)}... (${ASAAS_API_KEY.length} chars)`)
}

export async function asaasRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${ASAAS_API_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
      ...options.headers,
    },
  })

  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    data = { error: text }
  }

  if (!response.ok) {
    console.error(`[Asaas API Error] ${endpoint} → status ${response.status}:`, JSON.stringify(data))
    throw new Error(data.errors?.[0]?.description || data.error || `Erro Asaas (${response.status})`)
  }

  return data
}

/**
 * Calcula o split de pagamento entre plataforma, produtor e afiliado.
 * @param amount - Valor total da venda
 * @param commissionRate - Taxa de comissão do afiliado (%)
 * @param platformFeePercent - Taxa da plataforma (padrão 10%)
 */
export function calculateAsaasSplit(
  amount: number,
  commissionRate: number,
  platformFeePercent = 10
) {
  const platformFee = Number((amount * (platformFeePercent / 100)).toFixed(2))
  const affiliateCommission = commissionRate > 0
    ? Number((amount * (commissionRate / 100)).toFixed(2))
    : 0
  
  // O que sobra para o produtor após taxas e comissões
  const producerAmount = Number((amount - platformFee - affiliateCommission).toFixed(2))

  return {
    platformFee,
    affiliateCommission,
    producerAmount,
  }
}


/**
 * Cria uma conta filha (subconta) na Asaas.
 */
export async function createAsaasSubaccount(data: {
  name: string
  email: string
  cpfCnpj: string
  companyType: string
  phone: string
  mobilePhone?: string
  address: string
  addressNumber: string
  complement?: string
  province: string
  postalCode: string
  birthDate?: string
  incomeValue: number
}) {
  return asaasRequest('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function findAsaasSubaccountByEmail(email: string) {
  const response = await asaasRequest(`/accounts?email=${encodeURIComponent(email)}`, {
    method: 'GET'
  })
  return response.data?.[0] || null
}

export async function getOrCreateAsaasCustomer(name: string, email: string, cpfCnpj: string) {
  // Check if customer already exists
  const existing = await asaasRequest(`/customers?email=${encodeURIComponent(email)}`)

  if (existing.data && existing.data.length > 0) {
    const customer = existing.data[0]
    
    // Se o cliente existe mas não tem CPF na Asaas, precisamos atualizá-lo
    if (!customer.cpfCnpj && cpfCnpj) {
      console.log(`[Asaas] Cliente existente encontrado sem CPF. Atualizando ${customer.id} com CPF...`)
      return asaasRequest(`/customers/${customer.id}`, {
        method: 'POST', // Asaas uses POST to update customers
        body: JSON.stringify({ cpfCnpj })
      })
    }
    
    return customer
  }

  // Create new customer
  return asaasRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      cpfCnpj,
      externalReference: email,
    }),
  })
}

import 'server-only'

const DEFAULT_ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3'

export type AsaasCustomerPayload = {
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
  externalReference?: string
  notificationDisabled?: boolean
}

export type AsaasSubaccountPayload = AsaasCustomerPayload & {
  birthDate?: string
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'
  incomeValue?: number
}

export type AsaasCreditCardPayload = {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

export type AsaasCreditCardHolderInfo = {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  addressNumber: string
  addressComplement?: string | null
  phone?: string
  mobilePhone?: string
}

type RequestOptions = {
  apiKey?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

function getBaseUrl() {
  const url = process.env.ASAAS_API_URL
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ASAAS_API_URL is not defined')
    }
    return DEFAULT_ASAAS_API_URL
  }

  const clean = url.replace(/\/$/, '')

  if (process.env.NODE_ENV === 'production' && clean.includes('sandbox')) {
    throw new Error('ASAAS_API_URL aponta para o ambiente de sandbox em produção.')
  }

  return clean
}

function getApiKey(apiKey?: string) {
  const key = apiKey || process.env.ASAAS_API_KEY
  if (!key) {
    throw new Error('ASAAS_API_KEY is not defined')
  }
  return key
}

export function onlyDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

export function normalizeAsaasError(error: unknown) {
  if (!error || typeof error !== 'object') return 'Erro inesperado na Asaas.'

  const maybeErrors = (error as { errors?: Array<{ description?: string }> }).errors
  if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
    return maybeErrors.map(item => item.description).filter(Boolean).join(' ')
  }

  const message = (error as { message?: string; error?: string }).message || (error as { error?: string }).error
  return message || 'Erro inesperado na Asaas.'
}

export async function asaasRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET'
  const url = `${getBaseUrl()}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'User-Agent': 'Flowyn/1.0',
      access_token: getApiKey(options.apiKey),
    },
    body: method === 'GET' ? undefined : JSON.stringify(options.body || {}),
    cache: 'no-store',
  })

  const text = await response.text()
  let data: unknown = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text || `Resposta invalida da Asaas (${response.status}).` }
  }

  if (!response.ok) {
    console.error('[Asaas API Error]', {
      url,
      method,
      status: response.status,
      requestId: response.headers.get('request-id') || response.headers.get('x-request-id') || null,
    })
    throw new Error(normalizeAsaasError(data))
  }

  return data as T
}

export async function createSubaccount(payload: AsaasSubaccountPayload) {
  return asaasRequest<{
    id: string
    name: string
    email: string
    walletId: string
    apiKey: string
  }>('/accounts', {
    method: 'POST',
    body: payload,
  })
}

export async function retrieveSubaccount(accountId: string) {
  return asaasRequest<{
    id: string
    name: string
    email: string
    cpfCnpj?: string
    walletId?: string
  }>(`/accounts/${accountId}`)
}

export async function listSubaccounts(filters: { cpfCnpj?: string; email?: string }) {
  const params = new URLSearchParams()
  if (filters.cpfCnpj) params.set('cpfCnpj', onlyDigits(filters.cpfCnpj))
  if (filters.email) params.set('email', filters.email)

  return asaasRequest<{
    data?: Array<{
      id: string
      name: string
      email?: string
      cpfCnpj?: string
      walletId?: string
    }>
  }>(`/accounts?${params.toString()}`)
}

export async function createCustomer(payload: AsaasCustomerPayload, apiKey: string) {
  return asaasRequest<{ id: string; name: string; email?: string }>('/customers', {
    apiKey,
    method: 'POST',
    body: payload,
  })
}

export async function createCreditCardPayment(
  payload: {
    customer: string
    billingType: 'CREDIT_CARD'
    value: number
    dueDate: string
    description?: string
    externalReference: string
    split?: Array<{ walletId: string; percentualValue?: number; fixedValue?: number }>
    creditCard: AsaasCreditCardPayload
    creditCardHolderInfo: AsaasCreditCardHolderInfo
    remoteIp: string
  },
  apiKey: string
) {
  return asaasRequest<{
    id: string
    status: string
    value: number
    netValue?: number
    invoiceUrl?: string
    creditCard?: { creditCardNumber?: string; creditCardBrand?: string }
    creditCardToken?: string
  }>('/payments', {
    apiKey,
    method: 'POST',
    body: payload,
  })
}

export async function createCreditCardSubscription(
  payload: {
    customer: string
    billingType: 'CREDIT_CARD'
    value: number
    nextDueDate: string
    cycle: 'MONTHLY'
    description?: string
    externalReference?: string
    creditCard: AsaasCreditCardPayload
    creditCardHolderInfo: AsaasCreditCardHolderInfo
    remoteIp: string
  },
  apiKey: string
) {
  return asaasRequest<{
    id: string
    status: string
    cycle: string
    value: number
    nextDueDate?: string
  }>('/subscriptions', {
    apiKey,
    method: 'POST',
    body: payload,
  })
}

export async function cancelSubscription(subscriptionId: string, apiKey: string) {
  return asaasRequest<{ id: string; status?: string }>(`/subscriptions/${subscriptionId}`, {
    apiKey,
    method: 'DELETE',
  })
}

export async function retrievePayment(paymentId: string, apiKey: string) {
  return asaasRequest<{ id: string; status: string; value: number; netValue?: number; externalReference?: string }>(
    `/payments/${paymentId}`,
    { apiKey }
  )
}

export async function createPixPayment(
  payload: {
    customer: string
    billingType: 'PIX'
    value: number
    dueDate: string
    description?: string
    externalReference: string
    remoteIp?: string
    split?: Array<{ walletId: string; percentualValue?: number; fixedValue?: number }>
  },
  apiKey: string
) {
  return asaasRequest<{
    id: string
    status: string
    value: number
    pixQrCode?: string
    pixKey?: string
    invoiceUrl?: string
  }>('/payments', {
    apiKey,
    method: 'POST',
    body: payload,
  })
}

export async function getPixQrCode(paymentId: string, apiKey: string) {
  return asaasRequest<{
    encodedImage: string
    payload: string
    expirationDate: string
  }>(`/payments/${paymentId}/pixQrCode`, { apiKey })
}

export async function retrieveBalance(apiKey: string) {
  return asaasRequest<{ balance: number }>('/finance/balance', { apiKey })
}

export async function retrieveAccountInfo(apiKey: string) {
  return asaasRequest<{
    id: string
    name: string
    email: string
    cpfCnpj?: string
    walletId?: string
    status?: string
  }>('/accounts', { apiKey })
}

export type PixAutomaticFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'ANNUALLY'

export async function createPixAutomaticAuthorization(
  payload: {
    customerId: string
    frequency: PixAutomaticFrequency
    contractId: string
    startDate: string
    finishDate?: string
    value?: number
    description?: string
    immediateQrCode?: {
      minLimitValue?: number
      paymentCreationMode?: 'MANUAL' | 'SUBSCRIPTION'
      retryPolicy?: 'NOT_ALLOWED' | 'ALLOW_THREE_IN_SEVEN_DAYS'
    }
  },
  apiKey?: string
) {
  return asaasRequest<{
    id: string
    customerId: string
    frequency: string
    value?: number
    startDate: string
    finishDate?: string
    status: string
    immediateQrCode?: {
      encodedImage?: string
      payload?: string
      expirationDate?: string
      conciliationIdentifier?: string
    }
  }>('/pix/automatic/authorizations', {
    apiKey,
    method: 'POST',
    body: payload,
  })
}

export async function listPixAutomaticAuthorizations(
  params: {
    offset?: number
    limit?: number
    status?: string
    customerId?: string
  },
  apiKey?: string
) {
  const query = new URLSearchParams()
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.status) query.set('status', params.status)
  if (params.customerId) query.set('customerId', params.customerId)

  const qs = query.toString()
  return asaasRequest<{
    data: Array<{
      id: string
      customerId: string
      frequency: string
      value?: number
      startDate: string
      finishDate?: string
      status: string
    }>
    totalCount: number
  }>(`/pix/automatic/authorizations${qs ? `?${qs}` : ''}`, { apiKey })
}

export async function cancelPixAutomaticAuthorization(authorizationId: string, apiKey?: string) {
  return asaasRequest<{ id: string; status: string }>(
    `/pix/automatic/authorizations/${authorizationId}`,
    { apiKey, method: 'DELETE' }
  )
}

export async function createPixAutomaticCharge(
  payload: {
    pixAutomaticAuthorizationId: string
    billingType: 'PIX'
    value: number
    dueDate: string
    description?: string
    externalReference?: string
    status?: 'PENDING' | 'CONFIRMED' | 'RECEIVED'
  },
  apiKey?: string
) {
  return asaasRequest<{
    id: string
    status: string
    value: number
    pixQrCode?: string
    pixKey?: string
    invoiceUrl?: string
    dueDate?: string
  }>('/payments', {
    apiKey,
    method: 'POST',
    body: payload,
  })
}

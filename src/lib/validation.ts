export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function isValidPassword(value: string) {
  return String(value || '').trim().length >= 6
}

export function isValidFullName(value: string) {
  return String(value || '').trim().length >= 2
}

export function isValidCpfCnpj(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11) return isValidCpf(digits)
  if (digits.length === 14) return isValidCnpj(digits)
  return false
}

function isValidCpf(cpf: string) {
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  return remainder === parseInt(cpf[10])
}

function isValidCnpj(cnpj: string) {
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const multipliers1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const multipliers2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * multipliers1[i]
  let remainder = sum % 11
  if (remainder < 2) remainder = 0; else remainder = 11 - remainder
  if (remainder !== parseInt(cnpj[12])) return false
  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * multipliers2[i]
  remainder = sum % 11
  if (remainder < 2) remainder = 0; else remainder = 11 - remainder
  return remainder === parseInt(cnpj[13])
}

export function isValidPhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

export function isValidCardNumber(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false

  let sum = 0
  let doubleDigit = false
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index])
    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    doubleDigit = !doubleDigit
  }
  return sum % 10 === 0
}

export function isValidCvv(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 3 && digits.length <= 4
}

export function isValidPostalCode(value: string) {
  return /^\d{8}$/.test(String(value || '').replace(/\D/g, ''))
}

export function isValidCardExpiry(monthValue: string, yearValue: string) {
  const month = Number(String(monthValue || '').replace(/\D/g, ''))
  const rawYear = String(yearValue || '').replace(/\D/g, '')
  const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
  if (month < 1 || month > 12 || year < 2000 || rawYear.length !== 4) return false

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  return year > currentYear || (year === currentYear && month >= currentMonth)
}

export function isSafeRedirectPath(value: string | null | undefined) {
  if (!value) return false
  const trimmed = String(value).trim()
  if (!trimmed.startsWith('/')) return false
  if (trimmed.startsWith('//')) return false
  if (trimmed.includes('\n') || trimmed.includes('\r')) return false
  return true
}

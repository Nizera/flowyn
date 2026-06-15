export function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '')
}

export function formatCpfCnpj(value: string) {
  const digits = digitsOnly(value).slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\/\d{4})(\d)/, '$1-$2')
}

export function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function formatPostalCode(value: string) {
  return digitsOnly(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

export function formatCardNumber(value: string) {
  return digitsOnly(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

export type CepAddress = {
  postalCode: string
  street: string
  neighborhood: string
  city: string
  state: string
}

export async function lookupPostalCode(value: string): Promise<CepAddress> {
  const postalCode = digitsOnly(value)
  const response = await fetch(`/api/address/cep/${postalCode}`, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o CEP.')
  return data as CepAddress
}

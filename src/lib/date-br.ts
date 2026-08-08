// Helpers de data no timezone de Brasília (America/Sao_Paulo, UTC-3).
// O JavaScript padrão usa UTC em toISOString(), o que causa bugs quando o
// usuário está no Brasil — vendas criadas às 21:30 BRT aparecem como "dia seguinte"
// porque em UTC já é 00:30 do dia seguinte. Isso afeta filtros de data no dashboard,
// funil, campanhas e cobranças recorrentes.

/** Retorna a data de hoje em Brasília no formato 'YYYY-MM-DD' */
export function todayBr(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Retorna a data de hoje em Brasília formatada para input HTML (YYYY-MM-DD) */
export function todayBrIso(): string {
  return todayBr()
}

/**
 * Retorna Date ajustada para Brasília.
 * Útil quando precisa de year/month/day em vez de string.
 */
export function nowBr(): Date {
  const now = new Date()
  const brStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  return new Date(brStr)
}

/** Formata Date para 'YYYY-MM-DD' usando timezone de Brasília */
export function formatDateBr(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

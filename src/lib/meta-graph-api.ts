export const GRAPH_API_VERSION = 'v21.0'
export const GRAPH_API = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/**
 * Build a Meta Graph API URL with access_token in query string.
 * For GET requests this is the only supported method.
 * Token will appear in server logs — this is a known Meta API limitation.
 */
export function metaUrl(path: string, accessToken: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}access_token=${accessToken}`
}

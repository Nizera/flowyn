declare module 'meta-capi-param-builder-clientjs' {
  export function processAndCollectParams(url: string): Record<string, string>
  export function processAndCollectAllParams(url: string, getIpFn?: () => Promise<string>): Promise<Record<string, string>>
  export function getFbc(): string | null
  export function getFbp(): string | null
  export function getClientIpAddress(): string | null
  export function getNormalizedAndHashedPII(value: string): string
}

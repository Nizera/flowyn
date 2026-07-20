import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const ENCRYPTED_PREFIX = 'enc:'

function getKey(): Buffer {
  const hex = process.env.PAYMENT_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('PAYMENT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload = Buffer.concat([iv, tag, encrypted])
  return ENCRYPTED_PREFIX + payload.toString('base64')
}

export function decryptApiKey(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    console.error('[Encryption] Value not encrypted (missing enc: prefix). Refusing to decrypt — this indicates a data integrity issue.')
    throw new Error('ENCRYPTION_ERROR: Stored API key is not encrypted. Refusing to decrypt for security.')
  }

  const key = getKey()
  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64')

  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(ENCRYPTED_PREFIX))
}

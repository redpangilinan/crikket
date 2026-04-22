import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function deriveKey(secret: string): Buffer {
  if (!secret || secret.length < 32) {
    throw new Error(
      "Crypto secret must be at least 32 characters. Check BETTER_AUTH_SECRET."
    )
  }
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, authTag]).toString("base64")
}

export function decryptSecret(blob: string, secret: string): string {
  const key = deriveKey(secret)
  const buf = Buffer.from(blob, "base64")
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted blob: too short")
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

import { describe, expect, it } from "bun:test"
import { decryptSecret, encryptSecret } from "@crikket/shared/lib/server/crypto"

const SECRET = "0123456789abcdef0123456789abcdef"
const SHORT_SECRET_RE = /at least 32/i
const TOO_SHORT_RE = /too short/i

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext through encrypt then decrypt", () => {
    const plaintext = "ghp_abcdef0123456789"
    const blob = encryptSecret(plaintext, SECRET)
    expect(decryptSecret(blob, SECRET)).toBe(plaintext)
  })

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "ghp_abcdef0123456789"
    const a = encryptSecret(plaintext, SECRET)
    const b = encryptSecret(plaintext, SECRET)
    expect(a).not.toBe(b)
    // Both still decrypt to the same value.
    expect(decryptSecret(a, SECRET)).toBe(plaintext)
    expect(decryptSecret(b, SECRET)).toBe(plaintext)
  })

  it("fails to decrypt when the key is wrong", () => {
    const blob = encryptSecret("ghp_abcdef", SECRET)
    const wrongSecret = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
    expect(() => decryptSecret(blob, wrongSecret)).toThrow()
  })

  it("rejects secrets shorter than 32 characters", () => {
    expect(() => encryptSecret("payload", "short")).toThrow(SHORT_SECRET_RE)
    // Same rule applies on decrypt since it calls deriveKey.
    const blob = encryptSecret("payload", SECRET)
    expect(() => decryptSecret(blob, "short")).toThrow(SHORT_SECRET_RE)
  })

  it("rejects malformed encrypted blobs", () => {
    expect(() => decryptSecret("not-base64-at-all!!", SECRET)).toThrow()
    // Valid base64 but too short to contain IV + auth tag + 1 byte of ciphertext.
    const tooShort = Buffer.from("abcd").toString("base64")
    expect(() => decryptSecret(tooShort, SECRET)).toThrow(TOO_SHORT_RE)
  })

  it("fails when the ciphertext has been tampered with (auth tag check)", () => {
    const blob = encryptSecret("ghp_abcdef", SECRET)
    // Overwrite one byte in the middle of the ciphertext with a different value.
    const buf = Buffer.from(blob, "base64")
    const idx = buf.length - 20
    const original = buf[idx] ?? 0
    buf[idx] = original === 0x42 ? 0x43 : 0x42
    const tampered = buf.toString("base64")
    expect(() => decryptSecret(tampered, SECRET)).toThrow()
  })
})

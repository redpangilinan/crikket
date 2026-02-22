import { ORPCError } from "@orpc/server"

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024
const ATTACHMENT_LIMIT_MESSAGE = "100 MB"
const ATTACHMENT_SIGNATURE_SCAN_BYTES = 4096
const EMPTY_ATTACHMENT_MIME_TYPES = new Set(["", "application/octet-stream"])
const ATTACHMENT_MIME_TYPES = {
  screenshot: ["image/png"],
  video: ["video/webm"],
} as const

type AttachmentKind = keyof typeof ATTACHMENT_MIME_TYPES
type AttachmentMimeType = "image/png" | "video/webm"

export async function assertAttachmentIsSupported(input: {
  attachment: Blob
  attachmentType: AttachmentKind
}): Promise<void> {
  if (input.attachment.size <= 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Attachment is empty. Please capture a screenshot or video.",
    })
  }

  if (input.attachment.size > MAX_ATTACHMENT_BYTES) {
    throw new ORPCError("PAYLOAD_TOO_LARGE", {
      message: `Attachment exceeds the ${ATTACHMENT_LIMIT_MESSAGE} limit.`,
    })
  }

  const expectedMimeTypes = ATTACHMENT_MIME_TYPES[
    input.attachmentType
  ] as readonly string[]
  const normalizedMimeType = normalizeMimeType(input.attachment.type)
  if (expectedMimeTypes.includes(normalizedMimeType)) {
    return
  }

  if (EMPTY_ATTACHMENT_MIME_TYPES.has(normalizedMimeType)) {
    const inferredMimeType = await inferMimeTypeFromSignature(input.attachment)
    if (
      inferredMimeType !== null &&
      expectedMimeTypes.includes(inferredMimeType)
    ) {
      return
    }
  }

  throw new ORPCError("BAD_REQUEST", {
    message: `Unsupported ${input.attachmentType} attachment type: ${input.attachment.type || "unknown"}.`,
  })
}

function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ""
  }

  const [mimeType] = normalized.split(";")
  return mimeType?.trim() ?? ""
}

async function inferMimeTypeFromSignature(
  attachment: Blob
): Promise<AttachmentMimeType | null> {
  const buffer = new Uint8Array(await attachment.arrayBuffer())
  const header = buffer.subarray(
    0,
    Math.min(buffer.length, ATTACHMENT_SIGNATURE_SCAN_BYTES)
  )

  if (isPngSignature(header)) {
    return "image/png"
  }

  if (isWebmSignature(header)) {
    return "video/webm"
  }

  return null
}

function isPngSignature(header: Uint8Array): boolean {
  if (header.length < 8) {
    return false
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return pngSignature.every((byte, index) => header[index] === byte)
}

function isWebmSignature(header: Uint8Array): boolean {
  if (header.length < 4) {
    return false
  }

  const hasEbmlHeader =
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3

  if (!hasEbmlHeader) {
    return false
  }

  return containsAsciiSequence(header, [0x77, 0x65, 0x62, 0x6d]) // "webm"
}

function containsAsciiSequence(
  input: Uint8Array,
  sequence: readonly number[]
): boolean {
  if (input.length < sequence.length) {
    return false
  }

  for (let index = 0; index <= input.length - sequence.length; index += 1) {
    let matches = true

    for (
      let sequenceIndex = 0;
      sequenceIndex < sequence.length;
      sequenceIndex += 1
    ) {
      if (input[index + sequenceIndex] !== sequence[sequenceIndex]) {
        matches = false
        break
      }
    }

    if (matches) {
      return true
    }
  }

  return false
}

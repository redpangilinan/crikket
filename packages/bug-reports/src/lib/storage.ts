import { db } from "@crikket/db"
import { bugReportStorageCleanup } from "@crikket/db/schema/bug-report"
import { env } from "@crikket/env/server"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { S3Client } from "bun"
import { and, asc, eq, lte } from "drizzle-orm"
import { nanoid } from "nanoid"

/**
 * Storage interface for cloud-only attachments (S3-compatible providers).
 */
export interface StorageProvider {
  save(filename: string, data: Buffer | Blob): Promise<void>
  getUrl(filename: string): string
  remove(filename: string): Promise<void>
}

interface S3StorageOptions {
  provider: CloudStorageProvider
  bucket: string
  region: string
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl?: string
}

const CLOUD_STORAGE_PROVIDER_CONFIG = {
  r2: { usePathStyle: true },
  s3: { usePathStyle: false },
} as const

const STORAGE_CLEANUP_BASE_DELAY_MS = 60_000
const STORAGE_CLEANUP_MAX_DELAY_MS = 24 * 60 * 60 * 1000
const STORAGE_CLEANUP_DEFAULT_BATCH = 50
const STORAGE_CLEANUP_MAX_ERROR_LENGTH = 2000

type CloudStorageProvider = keyof typeof CLOUD_STORAGE_PROVIDER_CONFIG

/**
 * S3-compatible storage provider (AWS S3, Cloudflare R2)
 */
export function createS3StorageProvider(
  options: S3StorageOptions
): StorageProvider {
  const usePathStyle =
    CLOUD_STORAGE_PROVIDER_CONFIG[options.provider].usePathStyle

  const client = new S3Client({
    bucket: options.bucket,
    region: options.region,
    endpoint: options.endpoint,
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    virtualHostedStyle: !usePathStyle,
  })

  const getUrl = (filename: string): string => {
    if (options.publicUrl) {
      return `${trimTrailingSlash(options.publicUrl)}/${encodePathSegment(filename)}`
    }

    return client.presign(filename, {
      method: "GET",
      expiresIn: 604_800,
    })
  }

  return {
    async save(filename: string, data: Buffer | Blob): Promise<void> {
      const contentType = getMimeTypeFromFilename(filename)
      try {
        await client.write(
          filename,
          data,
          contentType ? { type: contentType } : undefined
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown upload error"
        throw new Error(
          `Failed to upload file to cloud storage (bucket: ${options.bucket}, endpoint: ${options.endpoint ?? "aws-default"}): ${message}`
        )
      }
    },
    getUrl,
    async remove(filename: string): Promise<void> {
      try {
        await client.delete(filename)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown delete error"
        throw new Error(
          `Failed to delete cloud attachment ${filename} from bucket ${options.bucket}: ${message}`
        )
      }
    },
  }
}

const storageProvider = createS3StorageProvider(getCloudStorageConfig())

export function getStorageProvider(): StorageProvider {
  return storageProvider
}

export function resolveAttachmentUrl(input: {
  attachmentKey: string | null
  attachmentUrl: string | null
}): string | null {
  if (input.attachmentKey) {
    return storageProvider.getUrl(input.attachmentKey)
  }

  return input.attachmentUrl
}

export function isExpiringSignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    return (
      parsed.searchParams.has("X-Amz-Algorithm") ||
      parsed.searchParams.has("X-Amz-Signature") ||
      parsed.searchParams.has("AWSAccessKeyId") ||
      parsed.searchParams.has("Signature") ||
      parsed.searchParams.has("Expires")
    )
  } catch {
    return false
  }
}

/**
 * Generate a unique filename with original extension preserved
 */
export function generateFilename(type: "video" | "screenshot"): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = type === "video" ? "webm" : "png"
  return `${type}_${timestamp}_${random}.${ext}`
}

export async function removeAttachmentEventually(
  attachmentKey: string
): Promise<void> {
  try {
    await storageProvider.remove(attachmentKey)
    await clearCleanupEntry(attachmentKey)
  } catch (error) {
    reportNonFatalError(
      `Failed to remove attachment ${attachmentKey}; queued for retry`,
      error
    )
    await queueAttachmentCleanup(attachmentKey, error)
  }
}

export async function runAttachmentCleanupPass(options?: {
  limit?: number
}): Promise<{ processed: number; removed: number; rescheduled: number }> {
  const now = new Date()
  const dueEntries = await db.query.bugReportStorageCleanup.findMany({
    where: lte(bugReportStorageCleanup.nextAttemptAt, now),
    orderBy: [asc(bugReportStorageCleanup.nextAttemptAt)],
    limit: options?.limit ?? STORAGE_CLEANUP_DEFAULT_BATCH,
  })

  let removed = 0
  let rescheduled = 0

  for (const entry of dueEntries) {
    try {
      await storageProvider.remove(entry.attachmentKey)
      await clearCleanupEntry(entry.attachmentKey)
      removed += 1
    } catch (error) {
      await scheduleCleanupRetry({
        attachmentKey: entry.attachmentKey,
        attempts: entry.attempts + 1,
        error,
      })
      rescheduled += 1
    }
  }

  return {
    processed: dueEntries.length,
    removed,
    rescheduled,
  }
}

export function extractStorageKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const pathSegments = getPathSegments(parsed.pathname)

    if (pathSegments.length === 0) {
      return null
    }

    if (env.STORAGE_PUBLIC_URL) {
      const publicBase = new URL(env.STORAGE_PUBLIC_URL)
      const publicBaseSegments = getPathSegments(publicBase.pathname)

      if (
        parsed.origin === publicBase.origin &&
        startsWithSegments(pathSegments, publicBaseSegments)
      ) {
        const keySegments = pathSegments.slice(publicBaseSegments.length)
        return keySegments.length > 0 ? decodePathSegments(keySegments) : null
      }

      return null
    }

    const bucketHostPrefix = `${env.STORAGE_BUCKET}.`
    if (parsed.hostname.startsWith(bucketHostPrefix)) {
      return decodePathSegments(pathSegments)
    }

    if (pathSegments[0] === env.STORAGE_BUCKET) {
      const keySegments = pathSegments.slice(1)
      return keySegments.length > 0 ? decodePathSegments(keySegments) : null
    }

    return null
  } catch (error) {
    reportNonFatalError(
      "Failed to extract storage key from attachment URL",
      { error, url },
      { once: true }
    )
    return null
  }
}

async function queueAttachmentCleanup(
  attachmentKey: string,
  error: unknown
): Promise<void> {
  try {
    const existing = await db.query.bugReportStorageCleanup.findFirst({
      where: eq(bugReportStorageCleanup.attachmentKey, attachmentKey),
      columns: {
        attempts: true,
      },
    })

    const attempts = (existing?.attempts ?? 0) + 1
    await scheduleCleanupRetry({
      attachmentKey,
      attempts,
      error,
    })
  } catch (queueError) {
    reportNonFatalError(
      `Failed to queue attachment cleanup for ${attachmentKey}`,
      queueError
    )
  }
}

async function clearCleanupEntry(attachmentKey: string): Promise<void> {
  try {
    await db
      .delete(bugReportStorageCleanup)
      .where(eq(bugReportStorageCleanup.attachmentKey, attachmentKey))
  } catch (error) {
    reportNonFatalError(
      `Failed to clear storage cleanup entry for ${attachmentKey}`,
      error
    )
  }
}

async function scheduleCleanupRetry(input: {
  attachmentKey: string
  attempts: number
  error: unknown
}): Promise<void> {
  const nextAttemptAt = new Date(
    Date.now() + calculateBackoffDelayMs(input.attempts)
  )
  const lastError = serializeCleanupError(input.error)

  await db
    .insert(bugReportStorageCleanup)
    .values({
      id: nanoid(16),
      attachmentKey: input.attachmentKey,
      attempts: input.attempts,
      nextAttemptAt,
      lastError,
    })
    .onConflictDoUpdate({
      target: bugReportStorageCleanup.attachmentKey,
      set: {
        attempts: input.attempts,
        nextAttemptAt,
        lastError,
        updatedAt: new Date(),
      },
      setWhere: and(
        eq(bugReportStorageCleanup.attachmentKey, input.attachmentKey)
      ),
    })
}

function calculateBackoffDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1)
  const delay = STORAGE_CLEANUP_BASE_DELAY_MS * 2 ** exponent
  return Math.min(delay, STORAGE_CLEANUP_MAX_DELAY_MS)
}

function serializeCleanupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, STORAGE_CLEANUP_MAX_ERROR_LENGTH)
}

function getCloudStorageConfig(): S3StorageOptions {
  const requiredKeys = [
    ["STORAGE_BUCKET", env.STORAGE_BUCKET],
    ["STORAGE_ACCESS_KEY_ID", env.STORAGE_ACCESS_KEY_ID],
    ["STORAGE_SECRET_ACCESS_KEY", env.STORAGE_SECRET_ACCESS_KEY],
  ] as const

  const missingKeys = requiredKeys
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required cloud storage env vars: ${missingKeys.join(", ")}. Local storage support has been removed.`
    )
  }

  const bucket = env.STORAGE_BUCKET!
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID!
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY!

  const region = env.STORAGE_REGION ?? (env.STORAGE_ENDPOINT ? "auto" : null)
  if (!region) {
    throw new Error(
      "Missing STORAGE_REGION. Set STORAGE_REGION or configure STORAGE_ENDPOINT for auto region resolution."
    )
  }

  return {
    provider: resolveCloudProvider(env.STORAGE_ENDPOINT),
    bucket,
    region,
    endpoint: env.STORAGE_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    publicUrl: env.STORAGE_PUBLIC_URL,
  }
}

function resolveCloudProvider(
  endpoint: string | undefined
): CloudStorageProvider {
  if (endpoint?.includes(".r2.cloudflarestorage.com")) return "r2"
  return "s3"
}

function getPathSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0)
}

function startsWithSegments(value: string[], prefix: string[]): boolean {
  if (prefix.length === 0) {
    return true
  }

  if (prefix.length > value.length) {
    return false
  }

  return prefix.every((segment, index) => value[index] === segment)
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function encodePathSegment(filename: string): string {
  return filename
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function decodePathSegments(pathSegments: string[]): string {
  return pathSegments.map((segment) => decodeURIComponent(segment)).join("/")
}

function getMimeTypeFromFilename(filename: string): string | null {
  if (filename.endsWith(".webm")) return "video/webm"
  if (filename.endsWith(".png")) return "image/png"
  return null
}

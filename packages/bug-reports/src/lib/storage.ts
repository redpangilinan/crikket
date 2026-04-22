import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { db } from "@crikket/db"
import { bugReportArtifactCleanup } from "@crikket/db/schema/bug-report"
import { env } from "@crikket/env/server"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { and, asc, eq, lte } from "drizzle-orm"
import { nanoid } from "nanoid"
import type { BugReportArtifactKind } from "./artifact-storage"

export interface StorageProvider {
  save(filename: string, data: Buffer | Blob): Promise<void>
  getUrl(filename: string): Promise<string>
  createUploadUrl(input: {
    filename: string
    contentEncoding?: string
    contentType?: string
  }): Promise<{
    headers: Record<string, string>
    method: "PUT"
    url: string
  }>
  exists(filename: string): Promise<boolean>
  read(filename: string): Promise<Buffer>
  remove(filename: string): Promise<void>
}

interface S3StorageOptions {
  bucket: string
  region: string
  endpoint?: string
  publicEndpoint?: string
  addressingStyle?: S3AddressingStyle
  accessKeyId: string
  secretAccessKey: string
  publicUrl?: string
}

const STORAGE_CLEANUP_BASE_DELAY_MS = 60_000
const STORAGE_CLEANUP_MAX_DELAY_MS = 24 * 60 * 60 * 1000
const STORAGE_CLEANUP_DEFAULT_BATCH = 50
const STORAGE_CLEANUP_MAX_ERROR_LENGTH = 2000
const PRESIGNED_GET_URL_TTL_SECONDS = 604_800
const AWS_S3_HOSTNAME_REGEX = /(^|[.-])s3([.-]|$)/

export type S3AddressingStyle = "auto" | "path" | "virtual"

export function createS3StorageProvider(
  options: S3StorageOptions
): StorageProvider {
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: resolveS3ForcePathStyle({
      endpoint: options.endpoint,
      addressingStyle: options.addressingStyle,
    }),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  })

  // Second client used only for presigning URLs returned to the browser. When
  // STORAGE_PUBLIC_ENDPOINT is set (e.g. local dev where the server reaches MinIO
  // at http://minio:9000 but the browser must use http://localhost:9000), this
  // ensures the signed Host matches what the browser will actually send.
  const presignerClient = options.publicEndpoint
    ? new S3Client({
        region: options.region,
        endpoint: options.publicEndpoint,
        forcePathStyle: resolveS3ForcePathStyle({
          endpoint: options.publicEndpoint,
          addressingStyle: options.addressingStyle,
        }),
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      })
    : client

  const getUrl = (filename: string): Promise<string> => {
    if (options.publicUrl) {
      return Promise.resolve(
        `${trimTrailingSlash(options.publicUrl)}/${encodePathSegment(filename)}`
      )
    }

    return getSignedUrl(
      presignerClient,
      new GetObjectCommand({
        Bucket: options.bucket,
        Key: filename,
      }),
      {
        expiresIn: PRESIGNED_GET_URL_TTL_SECONDS,
      }
    )
  }

  return {
    async save(filename: string, data: Buffer | Blob): Promise<void> {
      const contentType = getMimeTypeFromFilename(filename)
      try {
        const body = await normalizeUploadBody(data)
        await client.send(
          new PutObjectCommand({
            Bucket: options.bucket,
            Key: filename,
            Body: body,
            ContentType: contentType ?? undefined,
          })
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
    async createUploadUrl(input): Promise<{
      headers: Record<string, string>
      method: "PUT"
      url: string
    }> {
      const resolvedContentType =
        input.contentType ??
        getMimeTypeFromFilename(input.filename) ??
        undefined
      const headers: Record<string, string> = {}

      if (resolvedContentType) {
        headers["content-type"] = resolvedContentType
      }

      if (input.contentEncoding) {
        headers["content-encoding"] = input.contentEncoding
      }

      const url = await getSignedUrl(
        presignerClient,
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.filename,
          ContentEncoding: input.contentEncoding,
          ContentType: resolvedContentType,
        }),
        {
          expiresIn: PRESIGNED_GET_URL_TTL_SECONDS,
        }
      )

      return {
        url,
        method: "PUT",
        headers,
      }
    },
    async exists(filename: string): Promise<boolean> {
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: options.bucket,
            Key: filename,
          })
        )
        return true
      } catch {
        return false
      }
    },
    async read(filename: string): Promise<Buffer> {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: options.bucket,
          Key: filename,
        })
      )
      return await readBodyToBuffer(response.Body)
    },
    async remove(filename: string): Promise<void> {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: options.bucket,
            Key: filename,
          })
        )
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

export async function resolveCaptureUrl(input: {
  captureKey: string | null
}): Promise<string | null> {
  if (!input.captureKey) {
    return null
  }

  return await storageProvider.getUrl(input.captureKey)
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

export async function removeCaptureArtifactEventually(
  captureKey: string
): Promise<void> {
  await removeArtifactEventually({
    artifactKind: "capture",
    objectKey: captureKey,
  })
}

export async function removeArtifactEventually(input: {
  artifactKind: BugReportArtifactKind
  objectKey: string
}): Promise<void> {
  try {
    await storageProvider.remove(input.objectKey)
    await clearArtifactCleanupEntry(input.objectKey)
  } catch (error) {
    reportNonFatalError(
      `Failed to remove ${input.artifactKind} artifact ${input.objectKey}; queued for retry`,
      error
    )
    await queueArtifactCleanup(input, error)
  }
}

export async function runArtifactCleanupPass(options?: {
  limit?: number
}): Promise<{ processed: number; removed: number; rescheduled: number }> {
  const now = new Date()
  const dueEntries = await db.query.bugReportArtifactCleanup.findMany({
    where: lte(bugReportArtifactCleanup.nextAttemptAt, now),
    orderBy: [asc(bugReportArtifactCleanup.nextAttemptAt)],
    limit: options?.limit ?? STORAGE_CLEANUP_DEFAULT_BATCH,
  })

  let removed = 0
  let rescheduled = 0

  for (const entry of dueEntries) {
    try {
      await storageProvider.remove(entry.objectKey)
      await clearArtifactCleanupEntry(entry.objectKey)
      removed += 1
    } catch (error) {
      await scheduleArtifactCleanupRetry({
        artifactKind: entry.artifactKind as BugReportArtifactKind,
        objectKey: entry.objectKey,
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

async function queueArtifactCleanup(
  input: {
    artifactKind: BugReportArtifactKind
    objectKey: string
  },
  error: unknown
): Promise<void> {
  try {
    const existing = await db.query.bugReportArtifactCleanup.findFirst({
      where: eq(bugReportArtifactCleanup.objectKey, input.objectKey),
      columns: {
        attempts: true,
      },
    })

    const attempts = (existing?.attempts ?? 0) + 1
    await scheduleArtifactCleanupRetry({
      artifactKind: input.artifactKind,
      objectKey: input.objectKey,
      attempts,
      error,
    })
  } catch (queueError) {
    reportNonFatalError(
      `Failed to queue artifact cleanup for ${input.objectKey}`,
      queueError
    )
  }
}

async function clearArtifactCleanupEntry(objectKey: string): Promise<void> {
  try {
    await db
      .delete(bugReportArtifactCleanup)
      .where(eq(bugReportArtifactCleanup.objectKey, objectKey))
  } catch (error) {
    reportNonFatalError(
      `Failed to clear storage cleanup entry for ${objectKey}`,
      error
    )
  }
}

async function scheduleArtifactCleanupRetry(input: {
  artifactKind: BugReportArtifactKind
  objectKey: string
  attempts: number
  error: unknown
}): Promise<void> {
  const nextAttemptAt = new Date(
    Date.now() + calculateBackoffDelayMs(input.attempts)
  )
  const lastError = serializeCleanupError(input.error)

  await db
    .insert(bugReportArtifactCleanup)
    .values({
      id: nanoid(16),
      artifactKind: input.artifactKind,
      objectKey: input.objectKey,
      attempts: input.attempts,
      nextAttemptAt,
      lastError,
    })
    .onConflictDoUpdate({
      target: bugReportArtifactCleanup.objectKey,
      set: {
        artifactKind: input.artifactKind,
        attempts: input.attempts,
        nextAttemptAt,
        lastError,
        updatedAt: new Date(),
      },
      setWhere: and(eq(bugReportArtifactCleanup.objectKey, input.objectKey)),
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
    bucket,
    region,
    endpoint: env.STORAGE_ENDPOINT,
    publicEndpoint: env.STORAGE_PUBLIC_ENDPOINT,
    addressingStyle: env.STORAGE_ADDRESSING_STYLE,
    accessKeyId,
    secretAccessKey,
    publicUrl: env.STORAGE_PUBLIC_URL,
  }
}

export function resolveS3ForcePathStyle(input: {
  endpoint: string | undefined
  addressingStyle?: S3AddressingStyle
}): boolean {
  if (input.addressingStyle === "path") {
    return true
  }

  if (input.addressingStyle === "virtual") {
    return false
  }

  if (!input.endpoint) {
    return false
  }

  const hostname = getEndpointHostname(input.endpoint)
  if (!hostname) {
    return false
  }

  if (isCloudflareR2Hostname(hostname)) {
    return true
  }

  return !isAwsS3Hostname(hostname)
}

function getEndpointHostname(endpoint: string): string | null {
  try {
    return new URL(endpoint).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isCloudflareR2Hostname(hostname: string): boolean {
  return hostname.endsWith(".r2.cloudflarestorage.com")
}

function isAwsS3Hostname(hostname: string): boolean {
  if (!hostname.endsWith(".amazonaws.com")) {
    return false
  }

  return AWS_S3_HOSTNAME_REGEX.test(hostname)
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

function getMimeTypeFromFilename(filename: string): string | null {
  if (filename.endsWith(".webm")) return "video/webm"
  if (filename.endsWith(".png")) return "image/png"
  return null
}

async function normalizeUploadBody(data: Blob | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(data)) {
    return data
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function readBodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0)
  }

  if (body instanceof ReadableStream) {
    const reader = body.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      if (value) {
        chunks.push(value)
      }
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }

  throw new Error("Unsupported storage response body type.")
}

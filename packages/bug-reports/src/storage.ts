import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { env } from "@crikket/env/server"
import { S3Client } from "bun"

/**
 * Storage interface for flexible provider switching (local -> S3)
 */
export interface StorageProvider {
  save(filename: string, data: Buffer | Blob): Promise<string>
  getUrl(filename: string): string
  remove(filename: string): Promise<void>
}

interface LocalStorageOptions {
  basePath: string
  baseUrl?: string
  origin?: string
}

interface S3StorageOptions {
  provider: "s3" | "r2"
  bucket: string
  region: string
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
  usePathStyle?: boolean
  publicUrl?: string
}

/**
 * Local filesystem storage provider
 */
export function createLocalStorageProvider(
  options: LocalStorageOptions
): StorageProvider {
  const basePath = options.basePath
  const baseUrl = options.baseUrl ?? "/uploads"
  const origin = options.origin ?? env.BETTER_AUTH_URL

  const getUrl = (filename: string): string => {
    const relativePath = `${trimTrailingSlash(baseUrl)}/${encodePathSegment(filename)}`
    if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
      return relativePath
    }

    return `${trimTrailingSlash(origin)}${relativePath}`
  }

  return {
    async save(filename: string, data: Buffer | Blob): Promise<string> {
      await mkdir(basePath, { recursive: true })

      const filePath = path.join(basePath, filename)
      if (data instanceof Blob) {
        const buffer = Buffer.from(await data.arrayBuffer())
        await writeFile(filePath, buffer)
      } else {
        await writeFile(filePath, data)
      }

      return getUrl(filename)
    },
    getUrl,
    async remove(filename: string): Promise<void> {
      const filePath = path.join(basePath, filename)
      try {
        await rm(filePath, { force: true })
      } catch {
        // no-op: deleting a report should still succeed even if file is already missing
      }
    },
  }
}

/**
 * S3-compatible storage provider (AWS S3, Cloudflare R2)
 */
export function createS3StorageProvider(
  options: S3StorageOptions
): StorageProvider {
  const usePathStyle =
    options.provider === "r2" ? true : Boolean(options.usePathStyle)

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
    async save(filename: string, data: Buffer | Blob): Promise<string> {
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

      return getUrl(filename)
    },
    getUrl,
    async remove(filename: string): Promise<void> {
      try {
        await client.delete(filename)
      } catch {
        // no-op: keep report deletion resilient if object is missing or already removed
      }
    },
  }
}

/**
 * Get the configured storage provider
 * Uses local storage by default, can be extended to support S3
 */
export function getStorageProvider(): StorageProvider {
  const provider = env.STORAGE_PROVIDER
  const cloudProvider = resolveCloudProvider(provider, env.STORAGE_ENDPOINT)
  const cloudConfig = getCloudStorageConfig(cloudProvider)

  if (provider === "s3" || provider === "r2") {
    if (!cloudConfig) {
      throw new Error(
        "Cloud storage provider selected but STORAGE_BUCKET, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, or STORAGE_SECRET_ACCESS_KEY is missing"
      )
    }
    return createS3StorageProvider(cloudConfig)
  }

  if (provider === "auto" && cloudConfig) {
    return createS3StorageProvider(cloudConfig)
  }

  return createLocalStorageProvider({
    basePath: env.STORAGE_PATH,
    baseUrl: env.STORAGE_BASE_URL,
    origin: env.BETTER_AUTH_URL,
  })
}

/**
 * Generate a unique filename with original extension preserved
 */
export function generateFilename(
  _id: string,
  type: "video" | "screenshot"
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = type === "video" ? "webm" : "png"
  return `${type}_${timestamp}_${random}.${ext}`
}

export function extractStorageKeyFromUrl(
  url: string,
  provider: StorageProvider
): string | null {
  const marker = "/"
  try {
    const target = provider.getUrl(marker)
    const normalizedUrl = normalizeParsedUrl(url)
    const normalizedTarget = normalizeParsedUrl(target)

    if (
      normalizedUrl.origin !== normalizedTarget.origin ||
      !normalizedUrl.pathname.startsWith(normalizedTarget.pathname)
    ) {
      return null
    }

    const key = normalizedUrl.pathname.slice(normalizedTarget.pathname.length)
    return key.length > 0 ? decodeURIComponent(key) : null
  } catch {
    return null
  }
}

function getCloudStorageConfig(provider: "s3" | "r2"): {
  provider: "s3" | "r2"
  bucket: string
  region: string
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
  usePathStyle: boolean
  publicUrl?: string
} | null {
  const hasAnyCloudStorageValue =
    Boolean(env.STORAGE_BUCKET) ||
    Boolean(env.STORAGE_REGION) ||
    Boolean(env.STORAGE_ENDPOINT) ||
    Boolean(env.STORAGE_ACCESS_KEY_ID) ||
    Boolean(env.STORAGE_SECRET_ACCESS_KEY) ||
    Boolean(env.STORAGE_PUBLIC_URL)

  if (
    !(
      env.STORAGE_BUCKET &&
      env.STORAGE_ACCESS_KEY_ID &&
      env.STORAGE_SECRET_ACCESS_KEY
    )
  ) {
    if (hasAnyCloudStorageValue) {
      throw new Error(
        "Incomplete cloud storage config: set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY"
      )
    }
    return null
  }

  const region = env.STORAGE_REGION ?? (env.STORAGE_ENDPOINT ? "auto" : null)
  if (!region) {
    return null
  }

  return {
    provider,
    bucket: env.STORAGE_BUCKET,
    region,
    endpoint: env.STORAGE_ENDPOINT,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    usePathStyle: env.STORAGE_USE_PATH_STYLE,
    publicUrl: env.STORAGE_PUBLIC_URL,
  }
}

function resolveCloudProvider(
  provider: "auto" | "local" | "s3" | "r2",
  endpoint: string | undefined
): "s3" | "r2" {
  if (provider === "r2") return "r2"
  if (provider === "s3") return "s3"
  if (endpoint?.includes(".r2.cloudflarestorage.com")) return "r2"
  return "s3"
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

function normalizeParsedUrl(value: string): URL {
  const parsed = new URL(value)
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`
  }
  return parsed
}

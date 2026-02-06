import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { env } from "@crikket/env/server"

/**
 * Storage interface for flexible provider switching (local -> S3)
 */
export interface StorageProvider {
  save(filename: string, data: Buffer | Blob): Promise<string>
  getUrl(filename: string): string
}

/**
 * Local filesystem storage provider
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string
  private readonly baseUrl: string

  constructor(basePath: string, baseUrl = "/uploads") {
    this.basePath = basePath
    this.baseUrl = baseUrl
  }

  async save(filename: string, data: Buffer | Blob): Promise<string> {
    await mkdir(this.basePath, { recursive: true })

    const filePath = path.join(this.basePath, filename)

    if (data instanceof Blob) {
      const buffer = Buffer.from(await data.arrayBuffer())
      await writeFile(filePath, buffer)
    } else {
      await writeFile(filePath, data)
    }

    return this.getUrl(filename)
  }

  getUrl(filename: string): string {
    return `${this.baseUrl}/${filename}`
  }
}

/**
 * S3 storage provider (placeholder for production)
 * Implement this when ready to deploy to production
 */
export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string
  private readonly region: string

  constructor(bucket: string, region: string) {
    this.bucket = bucket
    this.region = region
  }

  save(_filename: string, _data: Buffer | Blob): Promise<string> {
    // TODO: Implement S3 upload when ready for production
    // const command = new PutObjectCommand({ Bucket: this.bucket, Key: filename, Body: data })
    // await s3Client.send(command)
    return Promise.reject(
      new Error(
        `S3 storage not implemented yet. Bucket: ${this.bucket}, Region: ${this.region}`
      )
    )
  }

  getUrl(_filename: string): string {
    // TODO: Return S3 URL or CloudFront URL
    throw new Error(
      `S3 storage not implemented yet. Bucket: ${this.bucket}, Region: ${this.region}`
    )
  }
}

/**
 * Get the configured storage provider
 * Uses local storage by default, can be extended to support S3
 */
export function getStorageProvider(): StorageProvider {
  const storagePath = env.STORAGE_PATH
  return new LocalStorageProvider(storagePath)
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

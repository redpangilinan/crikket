import { describe, expect, it } from "bun:test"

import { assertAttachmentIsSupported } from "../src/lib/attachment-validation"

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024

function createBlob(bytes: number[], type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type })
}

describe("assertAttachmentIsSupported", () => {
  it("accepts video/webm attachment", async () => {
    const attachment = createBlob(
      [0x1a, 0x45, 0xdf, 0xa3, 0x77, 0x65, 0x62, 0x6d],
      "video/webm"
    )

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "video",
      })
    ).resolves.toBeUndefined()
  })

  it("accepts unknown MIME video when bytes match webm signature", async () => {
    const attachment = createBlob(
      [0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d],
      ""
    )

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "video",
      })
    ).resolves.toBeUndefined()
  })

  it("rejects unknown MIME video when bytes are not webm", async () => {
    const attachment = createBlob([0x00, 0x11, 0x22, 0x33], "")

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "video",
      })
    ).rejects.toHaveProperty("code", "BAD_REQUEST")
  })

  it("accepts octet-stream screenshot when bytes match png signature", async () => {
    const attachment = createBlob(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      "application/octet-stream"
    )

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "screenshot",
      })
    ).resolves.toBeUndefined()
  })

  it("rejects mismatched attachment type", async () => {
    const attachment = createBlob(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      "image/png"
    )

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "video",
      })
    ).rejects.toHaveProperty("code", "BAD_REQUEST")
  })

  it("rejects empty attachments", async () => {
    const attachment = {
      size: 0,
      type: "video/webm",
    } as unknown as Blob

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "video",
      })
    ).rejects.toHaveProperty("code", "BAD_REQUEST")
  })

  it("rejects attachments above size limit", async () => {
    const attachment = {
      size: MAX_ATTACHMENT_BYTES + 1,
      type: "video/webm",
    } as unknown as Blob

    await expect(
      assertAttachmentIsSupported({
        attachment,
        attachmentType: "video",
      })
    ).rejects.toHaveProperty("code", "PAYLOAD_TOO_LARGE")
  })
})

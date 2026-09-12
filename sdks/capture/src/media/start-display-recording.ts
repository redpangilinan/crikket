import type { RecordingController } from "../types"
import {
  prepareCaptureVideo,
  releaseCaptureVideo,
  requestDisplayStream,
  resolveRecordingMimeType,
} from "./display-capture"

const RECORDING_AUDIO_BITS_PER_SECOND = 64_000
const RECORDING_VIDEO_BITS_PER_SECOND = 550_000

export async function startDisplayRecording(): Promise<RecordingController> {
  const stream = await requestDisplayStream(true)
  const warmupVideo = document.createElement("video")
  await prepareCaptureVideo(warmupVideo, stream)
  releaseCaptureVideo(warmupVideo)
  const mimeType = resolveRecordingMimeType()
  const recorderOptions =
    mimeType.length > 0
      ? {
          audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND,
          mimeType,
          videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
        }
      : {
          audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND,
          videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
        }
  const recorder = new MediaRecorder(stream, recorderOptions)

  const startedAt = Date.now()
  const chunks: Blob[] = []
  let resolveStop:
    | ((value: { blob: Blob; durationMs: number }) => void)
    | null = null
  let rejectStop: ((reason?: unknown) => void) | null = null

  const stopPromise = new Promise<{ blob: Blob; durationMs: number }>(
    (resolve, reject) => {
      resolveStop = resolve
      rejectStop = reject
    }
  )
  const handleStreamEnded = () => {
    if (recorder.state !== "inactive") {
      recorder.stop()
    }
  }

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  })

  recorder.addEventListener("error", (event) => {
    rejectStop?.(new Error(`MediaRecorder error: ${event.type}`))
  })

  recorder.addEventListener("stop", () => {
    for (const currentTrack of stream.getTracks()) {
      currentTrack.removeEventListener("ended", handleStreamEnded)
      currentTrack.stop()
    }

    const endedAt = Date.now()
    const blob = new Blob(chunks, {
      type: chunks[0]?.type || "video/webm",
    })

    resolveStop?.({
      blob,
      durationMs: Math.max(0, endedAt - startedAt),
    })
  })

  for (const currentTrack of stream.getTracks()) {
    currentTrack.addEventListener("ended", handleStreamEnded, {
      once: true,
    })
  }

  recorder.start(1000)

  return {
    finished: stopPromise,
    startedAt,
    stop: () => {
      if (recorder.state !== "inactive") {
        recorder.stop()
      }

      return stopPromise
    },
    abort: () => {
      if (recorder.state !== "inactive") {
        recorder.stop()
        return
      }

      for (const currentTrack of stream.getTracks()) {
        currentTrack.stop()
      }
    },
  }
}

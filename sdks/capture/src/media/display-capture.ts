interface CaptureDisplayMediaStreamOptions extends DisplayMediaStreamOptions {
  monitorTypeSurfaces?: "exclude" | "include"
  preferCurrentTab?: boolean
  selfBrowserSurface?: "exclude" | "include"
  surfaceSwitching?: "exclude" | "include"
  systemAudio?: "exclude" | "include"
}

const CAPTURE_FRAME_SETTLE_DELAY_MS = 120
const CAPTURE_FRAME_SETTLE_COUNT = 2

function getDisplayVideoConstraints(): MediaTrackConstraints {
  return {
    frameRate: 30,
    displaySurface: "browser",
  }
}

function createDisplayStreamOptions(
  audio: boolean
): CaptureDisplayMediaStreamOptions {
  return {
    video: getDisplayVideoConstraints(),
    audio,
    monitorTypeSurfaces: "exclude",
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    systemAudio: audio ? "include" : "exclude",
  }
}

// Display audio capture is a Chromium-only extension of getDisplayMedia, and
// Chromium is also the only engine exposing the spec's
// `suppressLocalAudioPlayback` constraint, so that is the feature detect.
// Requesting audio where it is unimplemented is at best ignored and at worst
// rejects the whole call.
export function supportsDisplayAudioCapture(): boolean {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getSupportedConstraints
  ) {
    return false
  }

  return (
    "suppressLocalAudioPlayback" in
    navigator.mediaDevices.getSupportedConstraints()
  )
}

export function requestDisplayStream(audio: boolean): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("This browser does not support screen capture.")
  }

  return navigator.mediaDevices.getDisplayMedia(
    createDisplayStreamOptions(audio && supportsDisplayAudioCapture())
  )
}

export async function prepareCaptureVideo(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  video.srcObject = stream
  video.muted = true
  video.playsInline = true

  await waitForTrackReadable(stream.getVideoTracks()[0])
  await waitForVideoMetadata(video)
  await video.play()
  await waitForSettledVideoFrames(video)
}

export function releaseCaptureVideo(video: HTMLVideoElement): void {
  video.pause()
  video.srcObject = null
}

export function resolveRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support video recording.")
  }

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }

  return ""
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate captured image."))
        return
      }

      resolve(blob)
    }, type)
  })
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onLoadedMetadata = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error("Failed to read captured video metadata."))
    }

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata)
      video.removeEventListener("error", onError)
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata, {
      once: true,
    })
    video.addEventListener("error", onError, {
      once: true,
    })
  })
}

function waitForTrackReadable(
  track: MediaStreamTrack | undefined
): Promise<void> {
  if (!track) {
    throw new Error("No video track available for capture.")
  }

  if (!track.muted) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      resolve()
    }, 1000)

    const onUnmute = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      track.removeEventListener("unmute", onUnmute)
    }

    track.addEventListener("unmute", onUnmute, {
      once: true,
    })
  })
}

async function waitForSettledVideoFrames(
  video: HTMLVideoElement,
  frameCount = CAPTURE_FRAME_SETTLE_COUNT
): Promise<void> {
  for (let index = 0; index < frameCount; index += 1) {
    await waitForNextVideoFrame(video)
  }

  await wait(CAPTURE_FRAME_SETTLE_DELAY_MS)
}

function waitForNextVideoFrame(video: HTMLVideoElement): Promise<void> {
  if ("requestVideoFrameCallback" in video) {
    return new Promise((resolve) => {
      video.requestVideoFrameCallback(() => {
        resolve()
      })
    })
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

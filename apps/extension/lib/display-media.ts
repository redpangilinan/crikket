interface TabCaptureConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: "tab"
    chromeMediaSourceId: string
  }
}

interface ScreenCaptureOptions extends DisplayMediaStreamOptions {
  monitorTypeSurfaces?: "include" | "exclude"
  selfBrowserSurface?: "include" | "exclude"
}

export interface CaptureStreamResult {
  stream: MediaStream
  cleanup: () => void
}

export const requestTabCaptureStream = async (
  tabId: number
): Promise<MediaStream> => {
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  })

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    } as TabCaptureConstraints,
  })

  return stream
}

/**
 * Asks the user to pick a full screen to record. Must be called from a user
 * gesture, since browsers require transient activation for getDisplayMedia.
 */
export const requestScreenCaptureStream = (): Promise<MediaStream> => {
  const options: ScreenCaptureOptions = {
    audio: false,
    video: { displaySurface: "monitor" },
    monitorTypeSurfaces: "include",
    selfBrowserSurface: "exclude",
  }

  return navigator.mediaDevices.getDisplayMedia(options)
}

const stopTracks = (stream: MediaStream | null): void => {
  for (const track of stream?.getTracks() ?? []) {
    track.stop()
  }
}

export const attachMicrophone = async (
  videoStream: MediaStream,
  microphoneEnabled: boolean
): Promise<CaptureStreamResult> => {
  if (!microphoneEnabled) {
    return { stream: videoStream, cleanup: () => undefined }
  }

  let micStream: MediaStream | null = null
  let audioCtx: AudioContext | null = null

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })

    audioCtx = new AudioContext()
    const destination = audioCtx.createMediaStreamDestination()
    const micSource = audioCtx.createMediaStreamSource(micStream)
    micSource.connect(destination)

    const videoTrack = videoStream.getVideoTracks()[0]
    const mixedStream = new MediaStream([
      videoTrack,
      ...destination.stream.getAudioTracks(),
    ])

    const cleanup = () => {
      stopTracks(micStream)
      audioCtx?.close().catch(() => undefined)
    }

    return { stream: mixedStream, cleanup }
  } catch {
    // Graceful fallback: mic unavailable, record video only
    stopTracks(micStream)
    audioCtx?.close().catch(() => undefined)
    return { stream: videoStream, cleanup: () => undefined }
  }
}

export const requestTabCaptureStreamWithMic = async (
  tabId: number,
  microphoneEnabled: boolean
): Promise<CaptureStreamResult> => {
  const tabStream = await requestTabCaptureStream(tabId)
  return attachMicrophone(tabStream, microphoneEnabled)
}

export const requestScreenCaptureStreamWithMic = async (
  microphoneEnabled: boolean
): Promise<CaptureStreamResult> => {
  const screenStream = await requestScreenCaptureStream()
  return attachMicrophone(screenStream, microphoneEnabled)
}

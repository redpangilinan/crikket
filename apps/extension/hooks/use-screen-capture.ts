import { useCallback, useRef, useState } from "react"

export interface UseScreenCaptureReturn {
  isRecording: boolean
  recordedBlob: Blob | null
  screenshotBlob: Blob | null
  error: string | null
  startRecording: () => Promise<boolean>
  stopRecording: () => Promise<Blob | null>
  takeScreenshot: () => Promise<Blob | null>
  reset: () => void
  setRecordedBlob: (blob: Blob | null) => void
  setScreenshotBlob: (blob: Blob | null) => void
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      setRecordedBlob(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false,
      })

      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        setRecordedBlob(blob)
        setIsRecording(false)

        for (const track of stream.getTracks()) {
          track.stop()
        }
      }
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop()
        }
      }

      mediaRecorder.start(1000)
      setIsRecording(true)
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start recording"
      setError(message)
      setIsRecording(false)
      return false
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state !== "recording"
      ) {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        setRecordedBlob(blob)
        setIsRecording(false)

        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop()
          }
        }

        resolve(blob)
      }

      mediaRecorderRef.current.stop()
    })
  }, [])

  const takeScreenshot = useCallback(async (): Promise<Blob | null> => {
    try {
      setError(null)
      setScreenshotBlob(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false,
      })

      const videoTrack = stream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()

      const video = document.createElement("video")
      video.srcObject = stream
      video.autoplay = true

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
          resolve()
        }
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const canvas = document.createElement("canvas")
      canvas.width = settings.width || video.videoWidth
      canvas.height = settings.height || video.videoHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      ctx.drawImage(video, 0, 0)

      for (const track of stream.getTracks()) {
        track.stop()
      }
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          setScreenshotBlob(blob)
          resolve(blob)
        }, "image/png")
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to take screenshot"
      setError(message)
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setRecordedBlob(null)
    setScreenshotBlob(null)
    setError(null)
    setIsRecording(false)

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
    }
  }, [])

  return {
    isRecording,
    recordedBlob,
    screenshotBlob,
    error,
    startRecording,
    stopRecording,
    takeScreenshot,
    reset,
    setRecordedBlob,
    setScreenshotBlob,
  }
}

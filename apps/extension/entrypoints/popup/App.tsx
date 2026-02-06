import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { Camera, Video } from "lucide-react"
import { useState } from "react"

type CaptureType = "video" | "screenshot"

function App() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCapture = async (captureType: CaptureType) => {
    setIsCapturing(true)
    setError(null)

    try {
      if (captureType === "screenshot") {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" },
          audio: false,
        })

        const blob = await captureScreenshot(stream)
        for (const track of stream.getTracks()) {
          track.stop()
        }

        const reader = new FileReader()
        reader.onloadend = () => {
          const base64data = reader.result as string
          chrome.storage.local.set({ pendingScreenshot: base64data }, () => {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                "/recorder.html?captureType=screenshot"
              ),
            })
            window.close()
          })
        }
        reader.readAsDataURL(blob)
      } else {
        chrome.storage.local.set({ startRecordingImmediately: true }, () => {
          chrome.tabs.create({
            url: chrome.runtime.getURL("/recorder.html?captureType=video"),
          })
          window.close()
        })
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to access screen")
      setIsCapturing(false)
    }
  }

  const captureScreenshot = (stream: MediaStream): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video")
      video.srcObject = stream
      video.autoplay = true
      video.muted = true

      video.onloadedmetadata = () => {
        video.play()
        setTimeout(() => {
          const canvas = document.createElement("canvas")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext("2d")
          ctx?.drawImage(video, 0, 0)

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to create blob"))
            }
          })
        }, 500)
      }

      video.onerror = () => reject(new Error("Video load error"))
    })
  }

  return (
    <div className="w-[380px] p-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">🦗 Crikket</CardTitle>
          <CardDescription>
            Capture and report bugs with screenshots or recordings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              className="w-full justify-start gap-3"
              disabled={isCapturing}
              onClick={() => startCapture("video")}
              size="lg"
              variant="default"
            >
              <Video className="h-5 w-5" />
              <span>Record Screen</span>
            </Button>

            <Button
              className="w-full justify-start gap-3"
              disabled={isCapturing}
              onClick={() => startCapture("screenshot")}
              size="lg"
              variant="outline"
            >
              <Camera className="h-5 w-5" />
              <span>Take Screenshot</span>
            </Button>
          </div>

          <div className="rounded-md border bg-muted p-3">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Select your screen or window to capture. A new tab will open for
              you to review and submit your report.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App

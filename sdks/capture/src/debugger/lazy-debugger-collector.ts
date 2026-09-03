import { SCREENSHOT_LOOKBACK_MS } from "../constants"
import type { CaptureType, ReviewSnapshot } from "../types"

interface DebuggerCollectorInstance {
  dispose: () => void
  clearSession: () => void
  finalizeSession: () => ReviewSnapshot
  markRecordingStarted: (recordingStartedAt: number) => void
  startSession: (captureType: CaptureType, lookbackMs?: number) => void
}

export class LazyDebuggerCollector {
  private collector: DebuggerCollectorInstance | null = null
  private collectorPromise: Promise<DebuggerCollectorInstance> | null = null

  // Installs the page runtime (fetch/XHR/console interceptors) without starting
  // a capture session, so events are buffered before the first capture.
  async warmUp(): Promise<void> {
    await this.ensureCollector()
  }

  async startScreenshotSession(
    lookbackMs = SCREENSHOT_LOOKBACK_MS
  ): Promise<void> {
    const collector = await this.ensureCollector()
    collector.startSession("screenshot", lookbackMs)
  }

  async startRecordingSession(): Promise<void> {
    const collector = await this.ensureCollector()
    collector.startSession("video")
  }

  markRecordingStarted(recordingStartedAt: number): void {
    this.collector?.markRecordingStarted(recordingStartedAt)
  }

  finalizeSession(): ReviewSnapshot {
    return this.collector?.finalizeSession() ?? buildMissingSessionReview()
  }

  clearSession(): void {
    this.collector?.clearSession()
  }

  dispose(): void {
    this.collectorPromise = null
    this.collector?.dispose()
    this.collector = null
  }

  private ensureCollector(): Promise<DebuggerCollectorInstance> {
    if (this.collector) {
      return Promise.resolve(this.collector)
    }

    if (this.collectorPromise) {
      return this.collectorPromise
    }

    const collectorPromise = import("./debugger-collector")
      .then(({ DebuggerCollector }) => {
        const collector = new DebuggerCollector()
        collector.install()
        this.collector = collector
        return collector satisfies DebuggerCollectorInstance
      })
      .finally(() => {
        if (this.collectorPromise === collectorPromise) {
          this.collectorPromise = null
        }
      })

    this.collectorPromise = collectorPromise
    return collectorPromise
  }
}

function buildMissingSessionReview(): ReviewSnapshot {
  return {
    warnings: [
      "Debugger session was not available. This report will not include debugger data.",
    ],
    debuggerSummary: {
      actions: 0,
      logs: 0,
      networkRequests: 0,
    },
  }
}

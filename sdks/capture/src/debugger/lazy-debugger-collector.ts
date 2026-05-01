import { SCREENSHOT_LOOKBACK_MS } from "../constants"
import type { CaptureType, ReviewSnapshot } from "../types"

interface DebuggerCollectorInstance {
  dispose: () => void
  clearSession: () => void
  finalizeSession: () => ReviewSnapshot
  markRecordingStarted: (recordingStartedAt: number) => void
  startSession: (captureType: CaptureType, lookbackMs?: number) => void
  hasActiveSession: () => boolean
  getSessionStartedAt: () => number | null
}

export class LazyDebuggerCollector {
  private collector: DebuggerCollectorInstance | null = null
  private collectorPromise: Promise<DebuggerCollectorInstance> | null = null

  async startScreenshotSession(): Promise<void> {
    const collector = await this.ensureCollector()
    collector.startSession("screenshot", SCREENSHOT_LOOKBACK_MS)
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

  async ensureSessionRestored(): Promise<number | null> {
    const collector = await this.ensureCollector()
    // ensureCollector() calls collector.install(), which restores the session from storage
    return collector.getSessionStartedAt()
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

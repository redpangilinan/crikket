import { FLUSH_INTERVAL_MS, MAX_BATCH_SIZE, PAGE_SOURCE } from "./constants"
import type { EventQueue } from "./types"

interface EventQueueDiagnostics {
  recordQueuedEvent?: () => void
  recordFlushedBatch?: () => void
}

export function createEventQueue(
  input: EventQueueDiagnostics = {}
): EventQueue {
  const { recordFlushedBatch, recordQueuedEvent } = input
  const eventQueue: unknown[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const flushEventQueue = () => {
    flushTimer = null

    if (eventQueue.length === 0) {
      return
    }

    const batchedEvents = eventQueue.splice(0, MAX_BATCH_SIZE)
    recordFlushedBatch?.()

    window.postMessage(
      {
        source: PAGE_SOURCE,
        events: batchedEvents,
      },
      "*"
    )

    if (eventQueue.length > 0) {
      flushTimer = setTimeout(flushEventQueue, 0)
      return
    }
  }

  const scheduleEventFlush = () => {
    if (flushTimer) {
      return
    }

    flushTimer = setTimeout(flushEventQueue, FLUSH_INTERVAL_MS)
  }

  const enqueueEvent = (event: unknown) => {
    eventQueue.push(event)
    recordQueuedEvent?.()

    if (eventQueue.length >= MAX_BATCH_SIZE) {
      if (flushTimer) {
        clearTimeout(flushTimer)
      }

      flushTimer = setTimeout(flushEventQueue, 0)
      return
    }

    scheduleEventFlush()
  }

  return {
    enqueueEvent,
    flushEventQueue,
  }
}

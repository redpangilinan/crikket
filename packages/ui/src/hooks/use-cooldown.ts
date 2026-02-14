"use client"

import * as React from "react"

import { useLocalStorage } from "./use-local-storage"

const COOLDOWN_UPDATED_EVENT = "crikket:cooldown-updated"
const DEFAULT_STORAGE_PREFIX = "crikket:cooldown:"

type CooldownUpdatedDetail = {
  expiresAt: number | null
  storageKey: string
}

type UseCooldownOptions = {
  durationSeconds: number
  key: string
  storagePrefix?: string
}

const parseStorageNumber = (rawValue: string | null): number | null => {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    return typeof parsed === "number" ? parsed : null
  } catch (_error) {
    return null
  }
}

const getRemainingSeconds = (
  expiresAt: number | null,
  nowMs: number
): number => {
  if (!expiresAt) {
    return 0
  }

  const remainingMs = expiresAt - nowMs
  if (remainingMs <= 0) {
    return 0
  }

  return Math.ceil(remainingMs / 1000)
}

const emitCooldownUpdate = (detail: CooldownUpdatedDetail) => {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent<CooldownUpdatedDetail>(COOLDOWN_UPDATED_EVENT, { detail })
  )
}

export const useCooldown = ({
  durationSeconds,
  key,
  storagePrefix = DEFAULT_STORAGE_PREFIX,
}: UseCooldownOptions) => {
  const storageKey = `${storagePrefix}${key}`
  const { removeValue, setValue, value } = useLocalStorage<number | null>(
    storageKey,
    null
  )
  const [expiresAt, setExpiresAt] = React.useState<number | null>(value)
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now())
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    setExpiresAt(value)
  }, [value])

  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  const effectiveExpiresAt = isHydrated ? expiresAt : null

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return
      }

      setExpiresAt(parseStorageNumber(event.newValue))
    }

    const onCooldownUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CooldownUpdatedDetail>).detail

      if (detail.storageKey !== storageKey) {
        return
      }

      setExpiresAt(detail.expiresAt)
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(COOLDOWN_UPDATED_EVENT, onCooldownUpdated)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(COOLDOWN_UPDATED_EVENT, onCooldownUpdated)
    }
  }, [storageKey])

  const remainingSeconds = React.useMemo(
    () => getRemainingSeconds(effectiveExpiresAt, nowMs),
    [effectiveExpiresAt, nowMs]
  )

  React.useEffect(() => {
    if (!isHydrated || remainingSeconds <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isHydrated, remainingSeconds])

  React.useEffect(() => {
    if (!isHydrated || remainingSeconds > 0 || !expiresAt) {
      return
    }

    removeValue()
    setExpiresAt(null)
    emitCooldownUpdate({ expiresAt: null, storageKey })
  }, [expiresAt, isHydrated, remainingSeconds, removeValue, storageKey])

  const start = React.useCallback(() => {
    const nextExpiresAt = Date.now() + durationSeconds * 1000
    setNowMs(Date.now())
    setValue(nextExpiresAt)
    setExpiresAt(nextExpiresAt)
    emitCooldownUpdate({ expiresAt: nextExpiresAt, storageKey })
  }, [durationSeconds, setValue, storageKey])

  const reset = React.useCallback(() => {
    setNowMs(Date.now())
    removeValue()
    setExpiresAt(null)
    emitCooldownUpdate({ expiresAt: null, storageKey })
  }, [removeValue, storageKey])

  return {
    isHydrated,
    isCoolingDown: remainingSeconds > 0,
    remainingSeconds,
    reset,
    start,
  } as const
}

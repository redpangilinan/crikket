import * as React from "react"

const DEFAULT_DEBOUNCE_MS = 500

export function useDebounce<T>(value: T, delayMs = DEFAULT_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [value, delayMs])

  return debouncedValue
}

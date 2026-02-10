import * as React from "react"

type SetValue<T> = T | ((previousValue: T) => T)

function getStorageValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") {
    return initialValue
  }

  const rawValue = window.localStorage.getItem(key)
  if (rawValue === null) {
    return initialValue
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return initialValue
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = React.useState<T>(() =>
    getStorageValue(key, initialValue)
  )

  React.useEffect(() => {
    setValue(getStorageValue(key, initialValue))
  }, [initialValue, key])

  const updateValue = React.useCallback(
    (nextValue: SetValue<T>) => {
      setValue((previousValue) => {
        const resolvedValue =
          nextValue instanceof Function ? nextValue(previousValue) : nextValue
        window.localStorage.setItem(key, JSON.stringify(resolvedValue))
        return resolvedValue
      })
    },
    [key]
  )

  const removeValue = React.useCallback(() => {
    window.localStorage.removeItem(key)
    setValue(initialValue)
  }, [initialValue, key])

  return { removeValue, setValue: updateValue, value } as const
}

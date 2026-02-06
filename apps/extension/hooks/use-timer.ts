import { useEffect, useState } from "react"

export function useTimer(startTime: number | null, isRunning: boolean) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setDuration(Date.now() - startTime)
      }, 100)
    }
    return () => clearInterval(interval)
  }, [isRunning, startTime])

  return duration
}

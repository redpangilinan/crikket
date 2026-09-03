import { useEffect, useRef } from "react"
import { init } from "./index"
import type { CaptureInitOptions } from "./types"

export type CapturePluginProps = Omit<CaptureInitOptions, "key"> & {
  publicKey: string
}

export function CapturePlugin(
  props: CapturePluginProps
): React.JSX.Element | null {
  const lifecycleVersionRef = useRef(0)

  useEffect(() => {
    const normalizedKey = props.publicKey?.trim()
    if (!normalizedKey) {
      return
    }

    lifecycleVersionRef.current += 1
    const lifecycleVersion = lifecycleVersionRef.current
    const controller = init({
      autoMount: props.autoMount,
      collectDebuggerEagerly: props.collectDebuggerEagerly,
      host: props.host,
      key: normalizedKey,
      mountTarget: props.mountTarget,
      submitPath: props.submitPath,
      submitTransport: props.submitTransport,
      zIndex: props.zIndex,
    })

    return () => {
      queueMicrotask(() => {
        if (lifecycleVersionRef.current !== lifecycleVersion) {
          return
        }

        controller.destroy()
      })
    }
  }, [
    props.autoMount,
    props.collectDebuggerEagerly,
    props.host,
    props.mountTarget,
    props.publicKey,
    props.submitPath,
    props.submitTransport,
    props.zIndex,
  ])

  return null
}

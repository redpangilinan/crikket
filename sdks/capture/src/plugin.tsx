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
      host: props.host,
      key: normalizedKey,
      launcher: props.launcher,
      mountTarget: props.mountTarget,
      onClose: props.onClose,
      onOpen: props.onOpen,
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
    props.host,
    props.launcher,
    props.mountTarget,
    props.onClose,
    props.onOpen,
    props.publicKey,
    props.submitPath,
    props.submitTransport,
    props.zIndex,
  ])

  return null
}

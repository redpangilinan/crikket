import { installFetchCapture } from "./fetch/install"
import type { NetworkCaptureInput } from "./types"
import { installXhrCapture } from "./xhr"

export function installNetworkCapture(input: NetworkCaptureInput): void {
  installFetchCapture(input)
  installXhrCapture(input)
}

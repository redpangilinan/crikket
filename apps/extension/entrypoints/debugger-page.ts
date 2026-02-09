import { defineUnlistedScript } from "wxt/utils/define-unlisted-script"
import { installDebuggerPageRuntime } from "@/lib/bug-report-debugger/engine/page"

export default defineUnlistedScript(() => {
  installDebuggerPageRuntime()
})

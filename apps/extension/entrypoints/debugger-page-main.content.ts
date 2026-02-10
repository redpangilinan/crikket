import { defineContentScript } from "wxt/utils/define-content-script"
import { installDebuggerPageRuntime } from "@/lib/bug-report-debugger/engine/page"

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    installDebuggerPageRuntime()
  },
})

import { installDebuggerPageRuntime } from "@/lib/bug-report-debugger/engine/page"

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  runAt: "document_start",
  world: "MAIN",
  main() {
    installDebuggerPageRuntime()
  },
})

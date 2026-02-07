import { setupDebuggerContentBridge } from "@/lib/bug-report-debugger"

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    setupDebuggerContentBridge()
  },
})

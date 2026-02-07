import { registerDebuggerBackgroundListeners } from "@/lib/bug-report-debugger"

export default defineBackground(() => {
  registerDebuggerBackgroundListeners()
})

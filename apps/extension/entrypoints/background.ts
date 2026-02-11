import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { registerDebuggerBackgroundListeners } from "@/lib/bug-report-debugger"
import { handleRecorderHotkeyCommand } from "@/lib/recorder-hotkey-commands"

export default defineBackground(() => {
  registerDebuggerBackgroundListeners()

  chrome.commands.onCommand.addListener((command) => {
    handleRecorderHotkeyCommand(command).catch(async (error: unknown) => {
      reportNonFatalError("Failed to execute recorder hotkey command", error)
      try {
        await chrome.action.openPopup()
      } catch (openPopupError) {
        reportNonFatalError(
          "Failed to open popup after hotkey failure",
          openPopupError
        )
      }
    })
  })
})

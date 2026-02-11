import { useEffect, useState } from "react"
import {
  START_RECORDING_COMMAND,
  START_SCREENSHOT_COMMAND,
  STOP_RECORDING_COMMAND,
} from "@/lib/recorder-hotkey-commands"

interface CommandShortcuts {
  startRecording: string | null
  startScreenshot: string | null
  stopRecording: string | null
}

const EMPTY_COMMAND_SHORTCUTS: CommandShortcuts = {
  startRecording: null,
  startScreenshot: null,
  stopRecording: null,
}

const COMMAND_TO_SHORTCUT_KEY = {
  [START_RECORDING_COMMAND]: "startRecording",
  [START_SCREENSHOT_COMMAND]: "startScreenshot",
  [STOP_RECORDING_COMMAND]: "stopRecording",
} as const satisfies Record<string, keyof CommandShortcuts>

function isTrackedCommandName(
  name: string
): name is keyof typeof COMMAND_TO_SHORTCUT_KEY {
  return Object.hasOwn(COMMAND_TO_SHORTCUT_KEY, name)
}

function mapCommandsToShortcuts(
  commands: chrome.commands.Command[]
): CommandShortcuts {
  const shortcuts = { ...EMPTY_COMMAND_SHORTCUTS }

  for (const command of commands) {
    const name = command.name
    const shortcut = command.shortcut

    if (!(name && shortcut)) {
      continue
    }

    if (!isTrackedCommandName(name)) {
      continue
    }

    const shortcutKey = COMMAND_TO_SHORTCUT_KEY[name]
    shortcuts[shortcutKey] = shortcut
  }

  return shortcuts
}

export function useCommandShortcuts(): CommandShortcuts {
  const [shortcuts, setShortcuts] = useState<CommandShortcuts>(
    EMPTY_COMMAND_SHORTCUTS
  )

  useEffect(() => {
    chrome.commands.getAll((commands) => {
      if (chrome.runtime.lastError) {
        setShortcuts(EMPTY_COMMAND_SHORTCUTS)
        return
      }

      setShortcuts(mapCommandsToShortcuts(commands))
    })
  }, [])

  return shortcuts
}

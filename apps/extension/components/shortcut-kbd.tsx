import { Kbd, KbdGroup } from "@crikket/ui/components/ui/kbd"

interface ShortcutKbdProps {
  shortcut: string | null
  className?: string
}

interface ShortcutKeyToken {
  id: string
  label: string
}

function toShortcutKeyTokens(shortcut: string): ShortcutKeyToken[] {
  const seenTokens = new Map<string, number>()
  const keyTokens: ShortcutKeyToken[] = []

  for (const rawKey of shortcut.split("+")) {
    const key = rawKey.trim()
    if (key.length === 0) {
      continue
    }

    const nextCount = (seenTokens.get(key) ?? 0) + 1
    seenTokens.set(key, nextCount)

    keyTokens.push({
      id: nextCount === 1 ? key : `${key}-${nextCount}`,
      label: key,
    })
  }

  return keyTokens
}

export function ShortcutKbd({ className, shortcut }: ShortcutKbdProps) {
  if (!shortcut) {
    return null
  }

  const tokens = toShortcutKeyTokens(shortcut)
  if (tokens.length === 0) {
    return null
  }

  return (
    <KbdGroup className="ml-auto">
      {tokens.map((token) => (
        <Kbd className={className} key={token.id}>
          {token.label}
        </Kbd>
      ))}
    </KbdGroup>
  )
}

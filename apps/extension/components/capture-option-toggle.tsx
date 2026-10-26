import type { ReactNode } from "react"

interface CaptureOptionToggleProps {
  checked: boolean
  disabled: boolean
  iconOff: ReactNode
  iconOn: ReactNode
  labelOff: string
  labelOn: string
  onToggle: () => void
}

export function CaptureOptionToggle({
  checked,
  disabled,
  iconOff,
  iconOn,
  labelOff,
  labelOn,
  onToggle,
}: CaptureOptionToggleProps) {
  return (
    <button
      aria-pressed={checked}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {checked ? iconOn : iconOff}
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
        {checked ? labelOn : labelOff}
      </span>
      <span className="ml-auto">
        <span
          className={`inline-block h-4 w-8 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
        />
      </span>
    </button>
  )
}

interface MicReadyStepProps {
  fullScreenEnabled: boolean
  microphoneEnabled: boolean
  onStart: () => void
}

function getReadyCopy(input: {
  fullScreenEnabled: boolean
  microphoneEnabled: boolean
}): { description: string; label: string } {
  if (input.fullScreenEnabled) {
    return {
      description: input.microphoneEnabled
        ? "Haz clic en el botón de abajo, elige la pantalla que quieres grabar y concede acceso al micrófono."
        : "Haz clic en el botón de abajo y elige la pantalla que quieres grabar.",
      label: "🖥️ Elegir pantalla y grabar",
    }
  }

  return {
    description:
      "Haz clic en el botón de abajo para conceder acceso al micrófono e iniciar la grabación.",
    label: "🎙️ Iniciar grabación con micrófono",
  }
}

export function MicReadyStep({
  fullScreenEnabled,
  microphoneEnabled,
  onStart,
}: MicReadyStepProps) {
  const { description, label } = getReadyCopy({
    fullScreenEnabled,
    microphoneEnabled,
  })

  return (
    <div className="flex flex-col items-center space-y-4 py-8">
      <p className="text-center text-muted-foreground text-sm">{description}</p>
      <button
        className="flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90"
        onClick={onStart}
        type="button"
      >
        {label}
      </button>
    </div>
  )
}

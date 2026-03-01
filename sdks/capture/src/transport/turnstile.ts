const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileRenderOptions {
  appearance?: "always" | "execute" | "interaction-only"
  callback?: (token: string) => void
  execution?: "execute" | "render"
  "error-callback"?: () => void
  "expired-callback"?: () => void
  sitekey: string
}

interface TurnstileApi {
  execute: (widgetId: string) => void
  remove?: (widgetId: string) => void
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null

export async function runTurnstileChallenge(siteKey: string): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Anti-bot verification requires a browser environment.")
  }

  const turnstile = await loadTurnstileApi()

  return new Promise((resolve, reject) => {
    const container = document.createElement("div")
    container.style.position = "fixed"
    container.style.right = "16px"
    container.style.bottom = "16px"
    container.style.zIndex = "2147483647"
    document.body.append(container)

    const cleanup = (widgetId: string) => {
      turnstile.remove?.(widgetId)
      container.remove()
    }

    const widgetId = turnstile.render(container, {
      appearance: "interaction-only",
      callback: (token) => {
        cleanup(widgetId)
        resolve(token)
      },
      execution: "execute",
      "error-callback": () => {
        cleanup(widgetId)
        reject(new Error("Anti-bot verification failed."))
      },
      "expired-callback": () => {
        cleanup(widgetId)
        reject(new Error("Anti-bot verification expired. Please try again."))
      },
      sitekey: siteKey,
    })

    turnstile.execute(widgetId)
  })
}

function loadTurnstileApi(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise
  }

  const scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_URL}"]`
    )
    if (existingScript) {
      if (window.turnstile) {
        resolve(window.turnstile)
        return
      }

      existingScript.addEventListener("load", () => {
        if (window.turnstile) {
          resolve(window.turnstile)
          return
        }

        reject(new Error("Turnstile did not initialize."))
      })
      existingScript.addEventListener("error", () => {
        reject(new Error("Failed to load anti-bot verification script."))
      })
      return
    }

    const script = document.createElement("script")
    script.async = true
    script.defer = true
    script.src = TURNSTILE_SCRIPT_URL
    script.addEventListener("load", () => {
      if (window.turnstile) {
        resolve(window.turnstile)
        return
      }

      reject(new Error("Turnstile did not initialize."))
    })
    script.addEventListener("error", () => {
      reject(new Error("Failed to load anti-bot verification script."))
    })
    document.head.append(script)
  }).finally(() => {
    if (!window.turnstile) {
      turnstileScriptPromise = null
    }
  })

  turnstileScriptPromise = scriptPromise
  return scriptPromise
}

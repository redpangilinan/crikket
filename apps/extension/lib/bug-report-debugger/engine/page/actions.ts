import { getElementTarget } from "./utils"

interface ActionCaptureInput {
  postAction: (
    actionType: string,
    target: string | undefined,
    metadata?: Record<string, unknown>
  ) => void
}

export function installActionAndNavigationCapture(
  input: ActionCaptureInput
): void {
  const { postAction } = input

  const postNavigationBreadcrumb = (mode: string) => {
    postAction("navigation", "window", {
      mode,
      url: location.href,
      path: location.pathname,
      search: location.search,
      hash: location.hash,
      title: document.title,
    })
  }

  const delegatedHandlers: Record<
    "click" | "input" | "change",
    (event: Event) => void
  > = {
    click: (event) => {
      postAction("click", getElementTarget(event.target))
    },
    input: (event) => {
      const target = getElementTarget(event.target)
      let valueLength: number | undefined

      const inputTarget = event.target
      if (
        inputTarget instanceof HTMLInputElement ||
        inputTarget instanceof HTMLTextAreaElement
      ) {
        valueLength = inputTarget.value.length
      }

      postAction("input", target, {
        valueLength,
      })
    },
    change: (event) => {
      postAction("change", getElementTarget(event.target))
    },
  }

  const delegatedListener = (event: Event) => {
    if (
      event.type !== "click" &&
      event.type !== "input" &&
      event.type !== "change"
    ) {
      return
    }

    delegatedHandlers[event.type](event)
  }

  for (const eventType of ["click", "input", "change"] as const) {
    document.addEventListener(eventType, delegatedListener, {
      capture: true,
      passive: true,
    })
  }

  const originalPushState = history.pushState
  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    postNavigationBreadcrumb("pushState")
  }

  const originalReplaceState = history.replaceState
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    postNavigationBreadcrumb("replaceState")
  }

  window.addEventListener(
    "popstate",
    () => {
      postNavigationBreadcrumb("popstate")
    },
    {
      capture: true,
      passive: true,
    }
  )

  window.addEventListener(
    "hashchange",
    () => {
      postNavigationBreadcrumb("hashchange")
    },
    {
      capture: true,
      passive: true,
    }
  )

  postNavigationBreadcrumb("initial")
}

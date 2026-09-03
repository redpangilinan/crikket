import { describe, expect, it } from "bun:test"

import {
  normalizeLauncherPlacement,
  resolveLauncherPlacementVars,
} from "../src/utils"

// Regression coverage: consumers must be able to position the launcher via an
// option instead of injecting CSS into the shadow tree (which was discarded
// when the runtime swapped its shadow host).

describe("normalizeLauncherPlacement", () => {
  it("defaults to bottom-right with a 24px offset", () => {
    expect(normalizeLauncherPlacement()).toEqual({
      position: "bottom-right",
      offset: { x: 24, y: 24 },
    })
  })

  it("falls back to the default for an invalid position", () => {
    expect(
      normalizeLauncherPlacement({
        position: "middle" as never,
      }).position
    ).toBe("bottom-right")
  })

  it("clamps negative offsets to zero", () => {
    expect(
      normalizeLauncherPlacement({ offset: { x: -10, y: -5 } }).offset
    ).toEqual({ x: 0, y: 0 })
  })
})

describe("resolveLauncherPlacementVars", () => {
  it("maps bottom-right to bottom/right insets", () => {
    expect(resolveLauncherPlacementVars()).toEqual({
      "--capture-launcher-top": "auto",
      "--capture-launcher-bottom": "24px",
      "--capture-launcher-left": "auto",
      "--capture-launcher-right": "24px",
    })
  })

  it("maps top-left with a custom offset to top/left insets", () => {
    expect(
      resolveLauncherPlacementVars({
        position: "top-left",
        offset: { x: 10, y: 8 },
      })
    ).toEqual({
      "--capture-launcher-top": "8px",
      "--capture-launcher-bottom": "auto",
      "--capture-launcher-left": "10px",
      "--capture-launcher-right": "auto",
    })
  })
})

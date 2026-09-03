import { afterEach, describe, expect, it } from "bun:test"

import {
  isLikelyMobileDevice,
  supportsDisplayCapture,
} from "../src/media/capabilities"

// Regression coverage: display-capture support detection must not rely on
// `"getDisplayMedia" in navigator.mediaDevices`, because Android browsers
// define the API but always reject it.

const originalNavigator = globalThis.navigator

function setNavigator(value: Record<string, unknown>): void {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  })
})

describe("isLikelyMobileDevice", () => {
  it("trusts userAgentData.mobile when present", () => {
    setNavigator({ userAgentData: { mobile: true }, userAgent: "" })
    expect(isLikelyMobileDevice()).toBe(true)

    setNavigator({ userAgentData: { mobile: false }, userAgent: "" })
    expect(isLikelyMobileDevice()).toBe(false)
  })

  it("detects Android and iPhone user agents", () => {
    setNavigator({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120" })
    expect(isLikelyMobileDevice()).toBe(true)

    setNavigator({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" })
    expect(isLikelyMobileDevice()).toBe(true)
  })

  it("treats a plain desktop Mac/Windows as not mobile", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 0,
    })
    expect(isLikelyMobileDevice()).toBe(false)
  })

  it("detects touch-first iPadOS reporting a Macintosh UA", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari",
      maxTouchPoints: 5,
    })
    expect(isLikelyMobileDevice()).toBe(true)
  })
})

describe("supportsDisplayCapture", () => {
  it("is true on desktop when getDisplayMedia exists", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 0,
      mediaDevices: { getDisplayMedia: () => Promise.resolve({}) },
    })
    expect(supportsDisplayCapture()).toBe(true)
  })

  it("is false on Android even though getDisplayMedia is defined", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile",
      mediaDevices: { getDisplayMedia: () => Promise.reject(new Error("no")) },
    })
    expect(supportsDisplayCapture()).toBe(false)
  })

  it("is false when getDisplayMedia is missing (iOS Safari)", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      mediaDevices: {},
    })
    expect(supportsDisplayCapture()).toBe(false)
  })
})

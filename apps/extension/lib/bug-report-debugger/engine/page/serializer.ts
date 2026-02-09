import {
  MAX_BODY_LENGTH,
  MAX_SERIALIZE_ARRAY_ITEMS,
  MAX_SERIALIZE_DEPTH,
  MAX_SERIALIZE_KEYS,
} from "./constants"
import type { Reporter } from "./types"
import { getElementTarget, truncate } from "./utils"

type SerializerState = {
  seen: WeakMap<object, string>
}

type PrimitiveSerializerResult =
  | {
      handled: true
      value: unknown
    }
  | {
      handled: false
    }

const serializePrimitive = (value: unknown): PrimitiveSerializerResult => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return {
      handled: true,
      value,
    }
  }

  if (typeof value === "string") {
    return {
      handled: true,
      value: truncate(value),
    }
  }

  if (typeof value === "undefined") {
    return {
      handled: true,
      value: "[undefined]",
    }
  }

  if (typeof value === "bigint") {
    return {
      handled: true,
      value: `${value.toString()}n`,
    }
  }

  if (typeof value === "symbol") {
    return {
      handled: true,
      value: value.toString(),
    }
  }

  if (typeof value === "function") {
    return {
      handled: true,
      value: `[Function ${value.name || "anonymous"}]`,
    }
  }

  return {
    handled: false,
  }
}

const serializeError = (value: Error) => {
  return {
    name: value.name,
    message: truncate(value.message),
    stack: typeof value.stack === "string" ? truncate(value.stack) : undefined,
  }
}

const isArrayBufferValue = (value: object): value is ArrayBuffer => {
  return typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer
}

const isArrayBufferViewValue = (value: object): value is ArrayBufferView => {
  return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)
}

type SerializeValue = (
  value: unknown,
  state: SerializerState,
  depth: number,
  path: string
) => unknown

const serializeArray = (
  value: unknown[],
  state: SerializerState,
  depth: number,
  path: string,
  serializeValue: SerializeValue
): unknown[] => {
  const serialized: unknown[] = []
  const limit = Math.min(value.length, MAX_SERIALIZE_ARRAY_ITEMS)

  for (let index = 0; index < limit; index += 1) {
    serialized.push(
      serializeValue(value[index], state, depth + 1, `${path}[${index}]`)
    )
  }

  if (value.length > limit) {
    serialized.push(`[+${value.length - limit} more]`)
  }

  return serialized
}

const serializeMap = (
  value: Map<unknown, unknown>,
  state: SerializerState,
  depth: number,
  path: string,
  serializeValue: SerializeValue
) => {
  const entries: unknown[] = []
  let index = 0

  for (const [entryKey, entryValue] of value.entries()) {
    if (index >= MAX_SERIALIZE_KEYS) {
      entries.push(`[+${value.size - index} more]`)
      break
    }

    entries.push([
      serializeValue(entryKey, state, depth + 1, `${path}.mapKey${index}`),
      serializeValue(entryValue, state, depth + 1, `${path}.mapVal${index}`),
    ])
    index += 1
  }

  return {
    type: "Map",
    entries,
  }
}

const serializeSet = (
  value: Set<unknown>,
  state: SerializerState,
  depth: number,
  path: string,
  serializeValue: SerializeValue
) => {
  const entries: unknown[] = []
  let index = 0

  for (const entry of value.values()) {
    if (index >= MAX_SERIALIZE_KEYS) {
      entries.push(`[+${value.size - index} more]`)
      break
    }

    entries.push(
      serializeValue(entry, state, depth + 1, `${path}.setVal${index}`)
    )
    index += 1
  }

  return {
    type: "Set",
    values: entries,
  }
}

const serializeRecordObject = (
  value: object,
  state: SerializerState,
  depth: number,
  path: string,
  serializeValue: SerializeValue
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  const entries = Object.entries(value)
  const limit = Math.min(entries.length, MAX_SERIALIZE_KEYS)

  for (let index = 0; index < limit; index += 1) {
    const [entryKey, entryValue] = entries[index] ?? []
    if (typeof entryKey !== "string") {
      continue
    }

    result[entryKey] = serializeValue(
      entryValue,
      state,
      depth + 1,
      `${path}.${entryKey}`
    )
  }

  if (entries.length > limit) {
    result.__truncatedKeys = entries.length - limit
  }

  return result
}

type ObjectSerializer = {
  canHandle: (value: object) => boolean
  serialize: (
    value: object,
    state: SerializerState,
    depth: number,
    path: string,
    serializeValue: SerializeValue
  ) => unknown
}

const objectSerializers: ObjectSerializer[] = [
  {
    canHandle: (value) => value instanceof Error,
    serialize: (value) => serializeError(value as Error),
  },
  {
    canHandle: (value) => value instanceof Date,
    serialize: (value) => (value as Date).toISOString(),
  },
  {
    canHandle: (value) => value instanceof RegExp,
    serialize: (value) => value.toString(),
  },
  {
    canHandle: (value) => typeof URL !== "undefined" && value instanceof URL,
    serialize: (value) => value.toString(),
  },
  {
    canHandle: (value) =>
      typeof Element !== "undefined" && value instanceof Element,
    serialize: (value) => {
      const element = value as Element
      return getElementTarget(element) ?? element.tagName.toLowerCase()
    },
  },
  {
    canHandle: (value) =>
      typeof Event !== "undefined" && value instanceof Event,
    serialize: (value) => {
      const event = value as Event
      return {
        type: event.type,
        target: getElementTarget(event.target),
      }
    },
  },
  {
    canHandle: (value) => Array.isArray(value),
    serialize: (value, state, depth, path, serializeValue) =>
      serializeArray(value as unknown[], state, depth, path, serializeValue),
  },
  {
    canHandle: (value) => value instanceof Map,
    serialize: (value, state, depth, path, serializeValue) =>
      serializeMap(
        value as Map<unknown, unknown>,
        state,
        depth,
        path,
        serializeValue
      ),
  },
  {
    canHandle: (value) => value instanceof Set,
    serialize: (value, state, depth, path, serializeValue) =>
      serializeSet(value as Set<unknown>, state, depth, path, serializeValue),
  },
  {
    canHandle: (value) => isArrayBufferValue(value),
    serialize: (value) => `[ArrayBuffer ${(value as ArrayBuffer).byteLength}]`,
  },
  {
    canHandle: (value) => isArrayBufferViewValue(value),
    serialize: (value) => {
      const bufferView = value as ArrayBufferView
      return `[${bufferView.constructor.name} ${bufferView.byteLength}]`
    },
  },
]

const serializeKnownObject = (
  value: object,
  state: SerializerState,
  depth: number,
  path: string,
  serializeValue: SerializeValue
): unknown => {
  for (const serializer of objectSerializers) {
    if (!serializer.canHandle(value)) {
      continue
    }

    return serializer.serialize(value, state, depth, path, serializeValue)
  }

  return serializeRecordObject(value, state, depth, path, serializeValue)
}

const toSerializableValue = (
  value: unknown,
  state: SerializerState,
  depth: number,
  path: string
): unknown => {
  const primitive = serializePrimitive(value)
  if (primitive.handled) {
    return primitive.value
  }

  if (depth >= MAX_SERIALIZE_DEPTH) {
    return "[MaxDepth]"
  }

  if (typeof value !== "object" || value === null) {
    return Object.prototype.toString.call(value)
  }

  const existingPath = state.seen.get(value)
  if (existingPath) {
    return `[Circular ~${existingPath}]`
  }

  state.seen.set(value, path)

  return serializeKnownObject(value, state, depth, path, toSerializableValue)
}

export function createStringifyValue(reporter: Reporter) {
  return (value: unknown): string => {
    if (typeof value === "string") {
      return truncate(value)
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      typeof value === "undefined"
    ) {
      return String(value)
    }

    try {
      const serialized = toSerializableValue(
        value,
        {
          seen: new WeakMap<object, string>(),
        },
        0,
        "$"
      )

      if (typeof serialized === "string") {
        return truncate(serialized)
      }

      return truncate(JSON.stringify(serialized))
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to stringify console value in debugger instrumentation",
        error
      )
      return truncate(Object.prototype.toString.call(value))
    }
  }
}

export const getRequestBodyPreview = (
  body: unknown,
  stringifyValue: (value: unknown) => string
): string | undefined => {
  if (!body) {
    return undefined
  }

  if (typeof body === "string") {
    return truncate(body, MAX_BODY_LENGTH)
  }

  if (body instanceof URLSearchParams) {
    return truncate(body.toString(), MAX_BODY_LENGTH)
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const keys: string[] = []
    for (const key of body.keys()) {
      keys.push(key)
    }

    return truncate(`[form-data] ${keys.join(",")}`, MAX_BODY_LENGTH)
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return `[blob:${body.type || "unknown"}:${body.size}]`
  }

  if (typeof ArrayBuffer !== "undefined") {
    if (body instanceof ArrayBuffer) {
      return `[arraybuffer:${body.byteLength}]`
    }

    if (ArrayBuffer.isView(body)) {
      return `[${body.constructor.name.toLowerCase()}:${body.byteLength}]`
    }
  }

  return truncate(stringifyValue(body), MAX_BODY_LENGTH)
}

export const shouldCaptureTextContent = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase()

  return (
    normalized.includes("json") ||
    normalized.includes("text") ||
    normalized.includes("xml") ||
    normalized.includes("x-www-form-urlencoded")
  )
}

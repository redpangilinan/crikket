# @crikket/capture

Embeddable capture SDK for collecting bug reports from websites.

## Install

```bash
npm install @crikket/capture
```

```bash
bun add @crikket/capture
```

## Quick Start

### 1. Create a public key

In Crikket, go to `Settings` -> `Public Keys`.

Create one public key per owned website or app surface, then add the exact
origins where the widget is allowed to run, for example:

- `https://example.com`
- `https://www.example.com`
- `http://localhost:3000`

Copy the generated public key after saving. Public keys are safe to embed in
client-side code.

### 2. Initialize the widget on your site

Call `init()` from a browser entrypoint in your app:

```ts
import { init } from "@crikket/capture"

init({
  key: "crk_your_public_key",
  host: "https://api.crikket.io",
})
```

If you are using Crikket Cloud, `host` defaults to `https://api.crikket.io`.
If you are self-hosting Crikket, pass your own app origin:

```ts
import { init } from "@crikket/capture"

init({
  key: "crk_your_public_key",
  host: "https://crikket.your-company.com",
})
```

That mounts the floating launcher and lets users capture a screenshot or screen
recording, fill out the report form, and submit directly from your site.

## Usage

### `init()` in any browser app

Use `init()` when you want the smallest integration surface. Run it once in a
browser-only entrypoint.

```ts
import { init } from "@crikket/capture"

init({
  key: "crk_your_public_key",
  host: "https://api.crikket.io",
})
```

Available options:

- `key`: required public key from Crikket `Settings` -> `Public Keys`
- `host`: optional Crikket app origin; defaults to `https://app.crikket.com`
- `autoMount`: mount automatically on init; defaults to `true`
- `mountTarget`: custom element to mount into; defaults to `document.body`
- `submitPath`: custom ingest path; defaults to `/api/embed/bug-reports`
- `zIndex`: custom widget stacking order

The package also exports runtime controls if you need them:

```ts
import { close, init, open } from "@crikket/capture"

init({
  key: "crk_your_public_key",
})

open()
close()
```

### Next.js 15.3+ with `instrumentation-client.ts`

For Next.js 15.3 and newer, initialize the SDK once in
`instrumentation-client.ts` so it runs globally in the browser.

```ts
import { init } from "@crikket/capture"

const capturePublicKey = process.env.NEXT_PUBLIC_CRIKKET_KEY

if (capturePublicKey) {
  init({
    key: capturePublicKey,
    host: process.env.NEXT_PUBLIC_CRIKKET_HOST ?? "https://api.crikket.io",
  })
}
```

Example file:

```ts
// instrumentation-client.ts
import { init } from "@crikket/capture"

const capturePublicKey = process.env.NEXT_PUBLIC_CRIKKET_KEY

if (capturePublicKey) {
  init({
    key: capturePublicKey,
    host: process.env.NEXT_PUBLIC_CRIKKET_HOST ?? "https://api.crikket.io",
  })
}
```

Recommended environment variables:

```bash
NEXT_PUBLIC_CRIKKET_KEY=crk_your_public_key
NEXT_PUBLIC_CRIKKET_HOST=https://api.crikket.io
```

If you are using Crikket Cloud, you can omit
`NEXT_PUBLIC_CRIKKET_HOST` and just pass the public key.

### React integration

If you prefer a React-native integration point, use the plugin from
`@crikket/capture/react` and mount it once near your app root.

```tsx
"use client"

import { CapturePlugin } from "@crikket/capture/react"

export function AppProviders(): React.JSX.Element {
  return (
    <>
      <CapturePlugin
        host="https://api.crikket.io"
        publicKey="crk_your_public_key"
      />
      {/* rest of your app */}
    </>
  )
}
```

With environment variables:

```tsx
"use client"

import { CapturePlugin } from "@crikket/capture/react"

export function CaptureProvider(): React.JSX.Element | null {
  const publicKey = process.env.NEXT_PUBLIC_CRIKKET_KEY

  if (!publicKey) {
    return null
  }

  return (
    <CapturePlugin
      host={process.env.NEXT_PUBLIC_CRIKKET_HOST}
      publicKey={publicKey}
    />
  )
}
```

`CapturePlugin` accepts the same options as `init()`, except it uses
`publicKey` instead of `key`.

## Notes

- Public keys should be scoped per website or app surface.
- Allowed origins should be exact HTTP(S) origins, including local development
  origins you want to permit.
- The SDK must run in a browser environment.
- Browser permission prompts for screen capture are expected platform behavior.

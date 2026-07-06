# @crikket-io/capture-angular

Angular integration for the [Crikket](https://crikket.io/) browser capture SDK
([`@crikket-io/capture`](https://www.npmjs.com/package/@crikket-io/capture)).
Crikket lets users file rich bug reports — screenshot / screen recording,
reproduction steps, console logs and network data — without leaving your app.

This package wraps the SDK for idiomatic Angular use:

- `provideCrikket()` — standalone provider for `bootstrapApplication`.
- `CrikketModule.forRoot()` — `NgModule` entry point.
- `CrikketService` — inject to `open()` / `close()` / `startRecording()` etc.
- **Lazy-loaded** — the SDK is `import()`-ed on demand, so it lands in its own
  chunk and never loads during **SSR**.
- **`enabled` flag** — keep the widget out of production with a one-liner.

Works with Angular **16–20**.

## Installation

```bash
npm install @crikket-io/capture-angular @crikket-io/capture react react-dom
```

`@crikket-io/capture`, `react` and `react-dom` are **peer dependencies**: the
capture widget UI is built in React and rendered into an isolated shadow DOM, so
`react` + `react-dom` (`>=18`) must be present. They are bundled into the
lazily-loaded chunk, not your main bundle. This wrapper never imports React
itself — it only loads `@crikket-io/capture`.

## Usage

### Standalone (recommended)

```ts
import { bootstrapApplication } from "@angular/platform-browser"
import { provideCrikket } from "@crikket-io/capture-angular"
import { AppComponent } from "./app/app.component"
import { environment } from "./environments/environment"

bootstrapApplication(AppComponent, {
  providers: [
    provideCrikket({
      key: "crk_your_public_key", // Settings -> Public Keys
      host: "https://api.crikket.io", // omit to use the default
      enabled: environment.name !== "production",
    }),
  ],
})
```

### NgModule

```ts
import { NgModule } from "@angular/core"
import { CrikketModule } from "@crikket-io/capture-angular"
import { environment } from "../environments/environment"

@NgModule({
  imports: [
    CrikketModule.forRoot({
      key: "crk_your_public_key",
      host: "https://api.crikket.io",
      enabled: environment.name !== "production",
    }),
  ],
})
export class AppModule {}
```

The widget launcher mounts automatically on app startup (via an
`APP_INITIALIZER`) whenever `enabled` is not `false`.

### Controlling the widget

```ts
import { Component, inject } from "@angular/core"
import { CrikketService } from "@crikket-io/capture-angular"

@Component({
  standalone: true,
  selector: "app-report-bug",
  template: `<button (click)="report()">Report a bug</button>`,
})
export class ReportBugComponent {
  private readonly crikket = inject(CrikketService)

  report(): void {
    this.crikket.open() // lazy-loads the SDK on first use
  }
}
```

## Configuration (`CrikketConfig`)

| Option        | Type          | Default                  | Description                                             |
| ------------- | ------------- | ------------------------ | ------------------------------------------------------- |
| `key`         | `string`      | — (required)             | Public capture key (`crk_...`).                         |
| `host`        | `string`      | `https://api.crikket.io` | Backend base URL. Set to your origin when self-hosting. |
| `enabled`     | `boolean`     | `true`                   | When `false`, the SDK is never loaded/initialized.      |
| `autoMount`   | `boolean`     | SDK default              | Auto-mount the launcher after init.                     |
| `mountTarget` | `HTMLElement` | —                        | Custom element to mount the widget into.                |
| `submitPath`  | `string`      | SDK default              | Custom public ingest path.                              |
| `zIndex`      | `number`      | SDK default              | Widget stacking order.                                  |

## `CrikketService` API

`init()`, `open()`, `close()`, `mount(target?)`, `unmount()`, `destroy()`,
`startRecording()`, `stopRecording()`, `takeScreenshot()`, plus the `isBrowser`
/ `isInitialized` getters. All are SSR-safe (no-ops on the server) and lazy-load
the SDK as needed.

## License

AGPL-3.0-only, matching `@crikket-io/capture`.

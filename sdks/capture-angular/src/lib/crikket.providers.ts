import {
  APP_INITIALIZER,
  type EnvironmentProviders,
  makeEnvironmentProviders,
} from "@angular/core"
import { CRIKKET_CONFIG, type CrikketConfig } from "./crikket.config"
import { CrikketService } from "./crikket.service"

/**
 * Registers Crikket for a standalone Angular application.
 *
 * Add to `bootstrapApplication(App, { providers: [...] })` or a route's
 * `providers`. Loads and initializes the capture widget during app startup via
 * an `APP_INITIALIZER`.
 *
 * @example
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideCrikket({
 *       key: "crk_your_public_key",
 *       host: "https://your-crikket-host",
 *       enabled: environment.name !== "production",
 *     }),
 *   ],
 * })
 */
export function provideCrikket(config: CrikketConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: CRIKKET_CONFIG, useValue: config },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (service: CrikketService) => (): Promise<void> =>
        service.init(config),
      deps: [CrikketService],
    },
  ])
}

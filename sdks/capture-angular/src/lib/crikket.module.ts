import {
  APP_INITIALIZER,
  type ModuleWithProviders,
  NgModule,
} from "@angular/core"
import { CRIKKET_CONFIG, type CrikketConfig } from "./crikket.config"
import { CrikketService } from "./crikket.service"

/**
 * NgModule entry point for Crikket, for apps still using `NgModule`
 * bootstrapping. Standalone apps should prefer {@link provideCrikket}.
 *
 * @example
 * \@NgModule({
 *   imports: [
 *     CrikketModule.forRoot({
 *       key: "crk_your_public_key",
 *       host: "https://your-crikket-host",
 *       enabled: environment.name !== "production",
 *     }),
 *   ],
 * })
 * export class AppModule {}
 */
@NgModule()
export class CrikketModule {
  static forRoot(config: CrikketConfig): ModuleWithProviders<CrikketModule> {
    return {
      ngModule: CrikketModule,
      providers: [
        { provide: CRIKKET_CONFIG, useValue: config },
        {
          provide: APP_INITIALIZER,
          multi: true,
          useFactory: (service: CrikketService) => (): Promise<void> =>
            service.init(config),
          deps: [CrikketService],
        },
      ],
    }
  }
}

import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { ConfigService } from './lib/config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [ConfigService],
      useFactory: (cfg: ConfigService) => () => cfg.load(),
    },
  ],
};

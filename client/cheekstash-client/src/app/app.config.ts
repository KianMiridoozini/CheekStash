// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
// Import provideRouter with withHashLocation
import { provideRouter, withHashLocation } from '@angular/router'; 
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { appRoutes as routes } from './app.routes';
import { AuthInterceptor } from './auth/auth.interceptor';
// Import LocationStrategy and HashLocationStrategy
import { LocationStrategy, HashLocationStrategy } from '@angular/common'; 

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withHashLocation is used to enable hash-based routing.
    provideRouter(routes, withHashLocation()), 
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    // Provide HashLocationStrategy
    { provide: LocationStrategy, useClass: HashLocationStrategy }, 
  ]
};

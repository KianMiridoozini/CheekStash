// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'; // Import withInterceptorsFromDi
import { HTTP_INTERCEPTORS } from '@angular/common/http'; // Import HTTP_INTERCEPTORS
import { appRoutes as routes } from './app.routes';
import { AuthInterceptor } from './auth/auth.interceptor'; // Import the AuthInterceptor

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()), // Configure HttpClient to use interceptors from DI
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ]
};

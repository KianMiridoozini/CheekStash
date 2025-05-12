import '@angular/compiler'; // Add this line for JIT compilation
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'; // Import appConfig

bootstrapApplication(AppComponent, appConfig) // Use appConfig here
  .catch(err => console.error(err));

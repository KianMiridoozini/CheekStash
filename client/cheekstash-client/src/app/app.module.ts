import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutesModule } from './app.routes.module';
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';

@NgModule({
  declarations: [AppComponent],  // AppComponent is declared here if it's not standalone,
  imports: [
    BrowserModule,
    AppRoutesModule,
    SharedModule,  // SharedModule now properly imports Navbar and Footer
    // ... any other modules
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

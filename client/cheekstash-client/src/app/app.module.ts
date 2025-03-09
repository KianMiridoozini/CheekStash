// // src/app/app.module.ts
// import { NgModule } from '@angular/core';
// import { BrowserModule } from '@angular/platform-browser';
// import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
// import { AppComponent } from './app.component';
// import { AppRoutesModule } from './app.routes.module';
// import { SharedModule } from './shared/shared.module';
// import { JwtInterceptor } from './auth/jwt.interceptor';

// @NgModule({
//   declarations: [AppComponent],
//   imports: [
//     BrowserModule,
//     HttpClientModule,
//     AppRoutesModule,
//     SharedModule,
//   ],
//   providers: [
//     { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }
//   ],
//   bootstrap: [AppComponent],
// })
// export class AppModule {}

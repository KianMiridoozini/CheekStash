import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar/navbar.component';
import { FooterComponent } from './footer/footer.component';

@NgModule({
  imports: [
    CommonModule,
    // Import standalone components; do not declare them
    NavbarComponent,
    FooterComponent,
  ],
  exports: [
    // Export them so other modules can use them
    NavbarComponent,
    FooterComponent,
  ]
})
export class SharedModule { }

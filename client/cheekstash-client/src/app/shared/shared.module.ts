import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar/navbar.component';
import { FooterComponent } from './footer/footer.component';
import { FormsModule } from '@angular/forms';
import { MessageComponent } from './components/message/message.component';
import { LoadingIndicatorComponent } from './components/loading-indicator/loading-indicator.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,

    NavbarComponent,
    FooterComponent,
    MessageComponent,
    LoadingIndicatorComponent
  ],
  exports: [
    CommonModule,
    FormsModule,
    
    NavbarComponent,
    FooterComponent,
    MessageComponent,
    LoadingIndicatorComponent
  ]
})
export class SharedModule { }

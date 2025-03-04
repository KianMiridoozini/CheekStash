import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,  // mark as standalone
  imports: [RouterModule],  // Import RouterModule to use routerLink directives
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']  // make sure this is plural
})
export class NavbarComponent {}

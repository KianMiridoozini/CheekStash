import { Component } from '@angular/core'; // Removed ElementRef, ViewChild
import { Router, RouterModule } from '@angular/router'; // Import Router
import { AuthService } from '../../auth/auth.service'; // Import AuthService
import { CommonModule } from '@angular/common'; // Import CommonModule for *ngIf

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule], // Add CommonModule
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  constructor(
    public authService: AuthService, 
    private router: Router
  ) {}

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { queryParams: { loggedOut: 'true' } }); 
  }

  isAdmin(): boolean {
    const user = this.authService.currentUserSignal();
    return !!user && user.role === 'admin';
  }
}

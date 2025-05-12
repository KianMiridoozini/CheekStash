import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AuthService, LoginResponse } from '../auth.service';
import { SharedModule } from '../../shared/shared.module';
import { LoginPayload } from '../../models/auth.model'; 
import { CommonModule } from '@angular/common';
import { MessageComponent } from '../../shared/components/message/message.component';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    SharedModule,
    RouterModule,
    CommonModule,
    MessageComponent,
    LoadingIndicatorComponent
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  credentials: LoginPayload = {
    email: '',
    password: ''
  };
  registrationMessage: string | null = null;
  errorMessage: string | null = null;
  logoutMessage: string | null = null;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['registered'] === 'true') {
        this.registrationMessage = 'Registration successful! You can now log in.';
        this.errorMessage = null;
        this.logoutMessage = null;
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { registered: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      } else if (params['loggedOut'] === 'true') {
        this.logoutMessage = 'You have been logged out successfully.';
        this.registrationMessage = null;
        this.errorMessage = null;
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { loggedOut: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }

  onSubmit(): void {
    this.registrationMessage = null;
    this.errorMessage = null;
    this.logoutMessage = null;
    this.isLoading = true;
    this.authService.login(this.credentials).subscribe({
      next: (response: LoginResponse) => {
        // console.log('Login successful, token:', response.token);
        localStorage.setItem('token', response.token);
        localStorage.setItem('username', response.username);
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        // console.error('Login error:', err);
        if (err.error && err.error.message) {
          this.errorMessage = Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
        } else if (err.status === 0) {
          this.errorMessage = 'Could not connect to the server. Please check your network connection.';
        } else if (err.status === 401) {
          this.errorMessage = 'Invalid email or password. Please try again.';
        } else {
          this.errorMessage = `Login failed (Status: ${err.status}). Please try again.`;
        }
      }
    });
  }
}

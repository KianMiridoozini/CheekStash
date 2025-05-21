import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router'; // Import RouterLink
import { UsersService } from '../../users/users.service';
import { SharedModule } from '../../shared/shared.module';
import { MessageComponent } from '../../shared/components/message/message.component';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { USERNAME_REGEX, PASSWORD_REGEX } from '../../models/user.model';


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    SharedModule,
    MessageComponent,
    LoadingIndicatorComponent,
    RouterLink 
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  userData = {
    username: '',
    email: '',
    password: ''
  };
  errorMessage: string | null = null; // Added for error messages
  isLoading: boolean = false;

  readonly usernamePattern = USERNAME_REGEX;
  readonly passwordPattern = PASSWORD_REGEX;

  constructor(
    private usersService: UsersService, 
    private router: Router
  ) {}

  isUsernameValid(): boolean {
    return this.usernamePattern.test(this.userData.username);
  }

  isPasswordValid(): boolean {
    return this.passwordPattern.test(this.userData.password);
  }

  onSubmit(): void {
    this.errorMessage = null; // Clear previous error on new submission
    if (!this.isUsernameValid()) {
      this.errorMessage = 'Username can only contain letters, numbers, and hyphens.';
      return;
    }
    if (!this.isPasswordValid()) {
      this.errorMessage = 'Password must contain at least one letter and one number.';
      return;
    }
    this.isLoading = true;
    this.usersService.register(this.userData).subscribe({
      next: (response) => {
        this.isLoading = false;
        // console.log('Registration successful:', response);
        // Navigate to login with a success message
        this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
      },
      error: (err) => {
        this.isLoading = false;
        // console.error('Registration error:', err);
        if (err.error && err.error.message) {
          // Prefer specific backend error message
          if (Array.isArray(err.error.message)) {
            this.errorMessage = err.error.message.join(', ');
          } else {
            this.errorMessage = err.error.message;
          }
        } else if (err.status === 0) {
          this.errorMessage = 'Could not connect to the server. Please check your network connection.';
        } else {
          // Generic fallback
          this.errorMessage = `Registration failed (Status: ${err.status}). Please try again.`;
        }
      }
    });
  }
}

import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AuthService, LoginResponse } from '../auth.service';
import { SharedModule } from '../../shared/shared.module';
import { LoginPayload } from '../../models/auth.model'; 
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    SharedModule,
    RouterModule,
    CommonModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  credentials: LoginPayload = {
    email: '',
    password: ''
  };
  registrationMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['registered'] === 'true') {
        this.registrationMessage = 'Registration successful! You can now log in.';
        // Optionally, remove the parameter from the URL after showing the message.
      }
    });
  }

  onSubmit(): void {
    this.authService.login(this.credentials).subscribe({
      next: (response: LoginResponse) => {
        console.log('Login successful, token:', response.token);
        localStorage.setItem('token', response.token);
        localStorage.setItem('username', response.username);

        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Login error:', error);
        // Show error message as needed
      }
    });
  }
}

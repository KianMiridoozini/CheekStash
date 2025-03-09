import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UsersService } from '../../users/users.service';
import { SharedModule } from '../../shared/shared.module';


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  userData = {
    username: '',
    email: '',
    password: ''
  };

  constructor(
    private usersService: UsersService, 
    private router: Router
  ) {}

  onSubmit(): void {
    this.usersService.register(this.userData).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.router.navigate(['/login'], { queryParams: { registered: 'true' } });

      },
      error: (err) => {
        console.error('Registration error:', err);
      }
    });
  }
}
